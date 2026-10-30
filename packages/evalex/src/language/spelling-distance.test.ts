import { fc, it } from '@fast-check/vitest';

import { spellingDistance } from './spelling-distance';

// A small alphabet in both cases, so names often share letters and differ in case alone
const name = fc.string({ unit: fc.constantFrom(...'abcdABCD'), maxLength: 8 });

describe(spellingDistance, () => {
  it.prop([name, name])('should count the same mistakes either way', (typed, meant) => {
    expect(spellingDistance({ typed, meant })).toBe(spellingDistance({ typed: meant, meant: typed }));
  });

  it.prop([name, name])('should count no mistake only between names that differ in case alone', (typed, meant) => {
    expect(spellingDistance({ typed, meant }) === 0).toBe(typed.toLowerCase() === meant.toLowerCase());
  });

  it.prop([name, name])('should count at most a mistake per character of the longer name', (typed, meant) => {
    expect(spellingDistance({ typed, meant })).toBeLessThanOrEqual(Math.max(typed.length, meant.length));
  });

  it.each([
    { typed: 'totl', meant: 'total', distance: 1 },
    { typed: 'totall', meant: 'total', distance: 1 },
    { typed: 'tetal', meant: 'total', distance: 1 },
    { typed: 'ttoal', meant: 'total', distance: 1 },
    { typed: 'Total', meant: 'total', distance: 0 },
    { typed: 'ttl', meant: 'total', distance: 2 },
    { typed: 'abc', meant: 'xyz', distance: 3 },
  ])('should count $distance mistakes between $typed and $meant', ({ typed, meant, distance }) => {
    expect(spellingDistance({ typed, meant })).toBe(distance);
  });
});
