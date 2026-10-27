import { FormulaNumber } from '../data-types';
import { arg } from '../routines/arguments';
import { routinesRegistry } from '../routines/registry';
import { isVolatileFormula } from '../volatile-formula';

routinesRegistry.registerRoutine('volatileProbe', {
  description: 'Returns the number unchanged, registered as volatile.',
  examples: [],
  arguments: [arg.number('number')],
  volatile: true,
  handler: ({ subject }) => new FormulaNumber(subject.value),
});

describe('isVolatileFormula', () => {
  it.each([
    'now()',
    '[a, today()]',
    'a > 0 ? now() : today()',
    'items.map(now())',
  ])('should mark %s as volatile', (formula) => {
    expect(isVolatileFormula(formula)).toBe(true);
  });

  it.each([
    'a + 1',
    'items.map(current * 2)',
    'abs(a)',
  ])('should not mark %s as volatile', (formula) => {
    expect(isVolatileFormula(formula)).toBe(false);
  });

  it('should mark a routine registered as volatile in both call forms', () => {
    expect(isVolatileFormula('volatileProbe(a)')).toBe(true);
    expect(isVolatileFormula('a.volatileProbe()')).toBe(true);
  });
});

describe('Routine.volatile', () => {
  it('should be set only for routines registered as volatile', () => {
    expect(routinesRegistry.getFunction('now')?.volatile).toBe(true);
    expect(routinesRegistry.getFunction('today')?.volatile).toBe(true);
    expect(routinesRegistry.getFunction('volatileProbe')?.volatile).toBe(true);
    expect(routinesRegistry.getFunction('abs')?.volatile).toBe(false);
  });
});
