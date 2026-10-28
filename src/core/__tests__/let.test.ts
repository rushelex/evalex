import { fc, it } from '@fast-check/vitest';

import { evaluate, evaluateOutcome, formulaValueArbitrary } from '../../testing-library';
import { FormulaArray, FormulaNumber, Kind } from '../data-types';

// Formulas of `a` and `b`, each written with a name for a repeated part and with that part spelled out.
const INLINED = [
  { withLet: 'let s = a + b in s * s', inlined: '(a + b) * (a + b)' },
  { withLet: 'let s = a, t = s - b in t / s', inlined: '(a - b) / a' },
  { withLet: 'let s = [a, b] in s.map(current * s.length())', inlined: '[a, b].map(current * [a, b].length())' },
  { withLet: 'let s = a in let t = s + b in t', inlined: 'a + b' },
] as const;

const hostNumber = fc.double({ noNaN: true, noDefaultInfinity: true });

describe('let expressions', () => {
  it.prop([fc.constantFrom(...INLINED), hostNumber, hostNumber])('should give the same result as the formula with each name spelled out', ({ withLet, inlined }, a, b) => {
    const context = { a: new FormulaNumber(a), b: new FormulaNumber(b) };

    expect(evaluateOutcome(withLet, { context })).toHaveSameOutcomeAs(evaluateOutcome(inlined, { context }));
  });

  it.prop([formulaValueArbitrary(), formulaValueArbitrary()])('should hide a host variable of the same name, in callbacks too', (own, host) => {
    const context = { price: host, items: FormulaArray.from([1]) };

    expect(evaluateOutcome('let price = own in items.map(price).first()', { context: { ...context, own } }))
      .toHaveSameOutcomeAs(evaluateOutcome('own', { context: { own } }));
  });

  it('should read the outer name again once an inner let that hides it ends', () => {
    expect(evaluate('let a = 1 in (let a = 2 in a * 10) + a')).toBeFormulaDataType(FormulaNumber, 21);
  });

  it('should compute a value inside a callback once for each item', () => {
    expect(evaluate('[1, 2, 3].map(let d = current * 2 in d + index)')).toBeFormulaDataType(FormulaArray, [new FormulaNumber(2), new FormulaNumber(5), new FormulaNumber(8)]);
  });

  it('should compute a value even when the body does not read it', () => {
    expect(() => evaluate('let unused = missing in 1')).toThrow('Variable "missing" is not defined. [13,20]');
  });

  it('should not compute a let inside a branch that is not taken', () => {
    expect(evaluate('if(false, let a = missing in a, 1)')).toBeFormulaDataType(FormulaNumber, 1);
  });

  it.prop([formulaValueArbitrary(Kind.Number)])('should treat a name declared with let like any other value', (value) => {
    expect(evaluateOutcome('let n = value in n.round()', { context: { value } })).toHaveSameOutcomeAs(evaluateOutcome('value.round()', { context: { value } }));
  });
});
