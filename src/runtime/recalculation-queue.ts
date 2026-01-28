export class RecalculationQueue {
  private readonly queue = new Set<string>();

  /**
   * Add a nodeId to the queue.
   */
  public enqueue(id: string): void {
    this.queue.add(id);
  }

  /**
   * Remove a nodeId from the queue.
   */
  public remove(id: string): void {
    this.queue.delete(id);
  }

  /**
   * Returns and removes the first nodeId from the queue, or undefined if empty.
   */
  public dequeue(): string | undefined {
    const iterator = this.queue.values();
    const next = iterator.next();

    if (next.done) {
      return undefined;
    }

    this.queue.delete(next.value);
    return next.value;
  }

  /**
   * Returns the number of items in the queue.
   */
  public size(): number {
    return this.queue.size;
  }
}
