import { fc, it } from '@fast-check/vitest';

import { Kind } from '../../../data-types';
import { arg } from '../arg';

const blankName = fc.stringMatching(/^\s*$/);

describe('arg', () => {
  it.prop([fc.string().filter((name) => name.trim() !== '')])('should keep any name that is not blank as it is', (name) => {
    expect(arg.number(name).name).toBe(name);
  });

  it.prop([blankName])('should refuse a blank name of a value argument', (name) => {
    expect(() => arg.number(name)).toThrow(new Error(`An argument name must not be blank, got "${name}".`));
  });

  it.prop([blankName])('should refuse a blank name of an argument evaluated per item', (name) => {
    expect(() => arg.eachItem(name, { returns: Kind.Boolean })).toThrow(new Error(`An argument name must not be blank, got "${name}".`));
  });

  it('should refuse an empty name of an argument that takes only some words', () => {
    expect(() => arg.choice('', ['days', 'months'])).toThrow(new Error('An argument name must not be blank, got "".'));
  });
});
