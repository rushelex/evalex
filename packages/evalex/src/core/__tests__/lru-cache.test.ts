import { fc, it } from '@fast-check/vitest';

import { LRUCache } from '../lru-cache';

describe(LRUCache, () => {
  it('should give back a value stored under a key', () => {
    const cache = new LRUCache<string, number>(2);

    cache.set('a', 1);

    expect(cache.get('a')).toBe(1);
  });

  it('should give nothing for a key never stored', () => {
    expect(new LRUCache<string, number>(2).get('a')).toBeUndefined();
  });

  it('should drop the least recently used key once past its capacity', () => {
    const cache = new LRUCache<string, number>(2);

    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);

    expect([cache.get('a'), cache.get('b'), cache.get('c')]).toEqual([1, undefined, 3]);
  });

  it('should replace the value of a key stored again without dropping another key', () => {
    const cache = new LRUCache<string, number>(2);

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 3);

    expect([cache.get('a'), cache.get('b')]).toEqual([3, 2]);
  });

  it.prop([fc.integer({ min: 1, max: 5 }), fc.array(fc.integer({ min: 0, max: 9 }))])(
    'should keep exactly the most recently stored distinct keys, as many as its capacity',
    (capacity, keys) => {
      const cache = new LRUCache<number, number>(capacity);

      for (const key of keys) {
        cache.set(key, key);
      }

      const recent = [...new Set(keys.toReversed())].slice(0, capacity);

      expect(cache.size).toBe(recent.length);

      for (const key of recent) {
        expect(cache.get(key)).toBe(key);
      }
    },
  );
});
