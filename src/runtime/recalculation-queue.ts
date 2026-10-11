/**
 * Formulas waiting to be recalculated, handed out shallowest first.
 *
 * @remarks
 * A formula is deeper than every formula it reads, so taking the shallowest one first evaluates it only after
 * the waiting formulas it reads, and the host never receives a value computed from a stale input. Formulas of
 * the same depth come out in the order they arrived. The depth is read once, when a formula arrives.
 */
/** One arrival of an id; once the id is removed or handed out, this arrival is stale even if the id arrives again. */
interface Arrival {
  readonly id: string;
}

/** Arrivals of one depth in arrival order, with the position of the next one to hand out. */
interface Group {
  readonly arrivals: Arrival[];
  next: number;
}

export class RecalculationQueue {
  readonly #depthOf: (id: string) => number;
  readonly #groups = new Map<number, Group>();
  // The live arrival of each waiting id; arrivals missing here are skipped when handed out
  readonly #waiting = new Map<string, Arrival>();
  // Depth of the group handed out next; Infinity while no group is left
  #shallowest = Infinity;

  /**
   * @param depthOf - the length of the longest chain of formulas a node reads through, 0 for a node that reads none
   */
  constructor(depthOf: (id: string) => number) {
    this.#depthOf = depthOf;
  }

  /**
   * Adds an id unless it is already waiting.
   */
  enqueue(id: string): void {
    if (this.#waiting.has(id)) {
      return;
    }

    const arrival: Arrival = { id };
    const depth = this.#depthOf(id);
    const group = this.#groups.get(depth);
    this.#waiting.set(id, arrival);

    if (group) {
      group.arrivals.push(arrival);
    }
    else {
      this.#groups.set(depth, { arrivals: [arrival], next: 0 });
    }

    if (depth < this.#shallowest) {
      this.#shallowest = depth;
    }
  }

  /**
   * Removes an id from the queue.
   */
  remove(id: string): void {
    this.#waiting.delete(id);
  }

  /**
   * Returns and removes the earliest arrived id of the smallest depth, or undefined if the queue is empty.
   */
  dequeue(): string | undefined {
    let group = this.#groups.get(this.#shallowest);

    while (group) {
      while (group.next < group.arrivals.length) {
        const arrival = group.arrivals[group.next++];

        if (this.#waiting.get(arrival.id) === arrival) {
          this.#waiting.delete(arrival.id);
          return arrival.id;
        }
      }

      this.#groups.delete(this.#shallowest);
      this.#shallowest = Math.min(...this.#groups.keys());
      group = this.#groups.get(this.#shallowest);
    }

    return undefined;
  }

  /**
   * Returns the number of items in the queue.
   */
  size(): number {
    return this.#waiting.size;
  }
}
