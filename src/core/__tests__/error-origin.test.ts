import { fc, it } from '@fast-check/vitest';

import { evaluate } from '../../testing-library';
import { FormulaNull } from '../data-types';

// Parts of a formula that hand on the value written in place of `VALUE` without changing it.
const PASS_THROUGH = [
  '(VALUE)',
  'if(true, VALUE, true)',
  'if(false, true, VALUE)',
  'true ? VALUE : true',
  'false ? true : VALUE',
  'let unused = 0 in VALUE',
] as const;

// Calls that reject a text value in place of `PART`, with the message of the error.
const REJECTING_TEXT = [
  { call: 'filter([1], PART)', message: 'Expected callback to return type Boolean, but got String.' },
  { call: '[1].filter(PART)', message: 'Expected callback to return type Boolean, but got String.' },
  { call: 'sum(PART)', message: 'Expected type Array | Number.' },
] as const;

describe('error locations', () => {
  it.prop([fc.constantFrom(...PASS_THROUGH), fc.constantFrom(...REJECTING_TEXT), fc.stringMatching(/^[a-z]{0,5}$/)])('should point at a rejected value, not at the part that handed it on', (passThrough, { call, message }, text) => {
    const value = `"${text}"`;
    const part = passThrough.replace('VALUE', value);
    const formula = call.replace('PART', part);
    const start = call.indexOf('PART') + passThrough.indexOf('VALUE');

    expect(() => evaluate(formula)).toThrow(`${message} [${start},${start + value.length}]`);
  });

  it.each([
    { formula: 'filter([1], if(current > 1, true, 5))', at: [34, 35] },
    { formula: '[1].filter(if(current > 1, true, 5))', at: [33, 34] },
  ])('should point at the branch a callback returned in $formula', ({ formula, at }) => {
    expect(() => evaluate(formula)).toThrow(`Expected callback to return type Boolean, but got Number. [${at[0]},${at[1]}]`);
  });

  it('should accept an argument when the branch taken has the right type', () => {
    expect(() => evaluate('sum(if(true, 1, "a"))')).not.toThrow();
  });

  it('should point at the branch taken when its value is rejected', () => {
    expect(() => evaluate('sum(if(false, 1, "a"))')).toThrow('Expected type Array | Number. [17,20]');
  });

  it('should point at the name a rejected value was read through, not at where it was declared', () => {
    expect(() => evaluate('let v = "a" in sum(v)')).toThrow('Expected type Array | Number. [19,20]');
  });

  it('should point at the whole callback when it computes a new value', () => {
    expect(() => evaluate('filter([1], current + 1)')).toThrow('Expected callback to return type Boolean, but got Number. [12,23]');
  });

  it('should point an inner callback error inside the inner callback', () => {
    expect(() => evaluate('[[1]].filter(current.filter(if(true, 5, true)).length() > 0)')).toThrow('Expected callback to return type Boolean, but got Number. [37,38]');
  });

  it('should point an outer callback error at the outer callback, not inside an inner one', () => {
    expect(() => evaluate('[[1]].filter(current.filter(if(true, true, 5)).length())')).toThrow('Expected callback to return type Boolean, but got Number. [13,55]');
  });

  it.prop([fc.constantFrom(...PASS_THROUGH)])('should point at an empty value a method is read from, not at the method', (passThrough) => {
    const formula = `(${passThrough.replace('VALUE', 'null')}).rate()`;
    const start = 1 + passThrough.indexOf('VALUE');

    expect(() => evaluate(formula)).toThrow(`Cannot read "rate" of an empty value. [${start},${start + 4}]`);
  });

  it('should point at the name an empty value was read through', () => {
    expect(() => evaluate('project.rate()', { context: { project: FormulaNull.instance() } })).toThrow('Cannot read "rate" of an empty value. [0,7]');
  });
});
