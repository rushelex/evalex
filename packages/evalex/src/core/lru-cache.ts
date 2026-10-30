/**
 * Cache that keeps the most recently used entries and drops the least recently used one past its capacity.
 *
 * @remarks
 * Keeps a cache keyed by data the host controls, such as formula text, from growing for as long as the page lives.
 * A `Map` iterates in insertion order, so moving a used key to the end leaves the least recently used one first.
 */
export class LRUCache<TKey, TValue extends NonNullable<unknown>> {
  readonly #capacity: number;
  readonly #entries = new Map<TKey, TValue>();

  constructor(capacity: number) {
    this.#capacity = capacity;
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: TKey): TValue | undefined {
    const value = this.#entries.get(key);

    if (value === undefined) {
      return undefined;
    }

    this.#entries.delete(key);
    this.#entries.set(key, value);

    return value;
  }

  set(key: TKey, value: TValue): void {
    this.#entries.delete(key);
    this.#entries.set(key, value);

    if (this.#entries.size > this.#capacity) {
      const [leastRecent] = this.#entries.keys();
      this.#entries.delete(leastRecent);
    }
  }
}
