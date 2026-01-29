import type { EvaluateOptions } from '../../expression';

import { Temporal } from 'temporal-polyfill';

import { evaluate } from '../../../testing-library';
import { FormulaNumber } from '../number';
import { FormulaDuration } from './FormulaDuration';

describe('FormulaDuration', () => {
  const contextOptions: EvaluateOptions = {
    context: {
      d: new FormulaDuration(Temporal.Duration.from({ years: 2, months: 5, days: 10, hours: 12, minutes: 30, seconds: 15 })),
    },
  };

  it('should return the number of years', () => {
    const result = evaluate('d.years()', contextOptions);
    expect(result).toBeFormulaDataType(FormulaNumber, 2);
  });

  it('should return the number of months', () => {
    const result = evaluate('d.months()', contextOptions);
    expect(result).toBeFormulaDataType(FormulaNumber, 5);
  });

  it('should return the number of days', () => {
    const result = evaluate('d.days()', contextOptions);
    expect(result).toBeFormulaDataType(FormulaNumber, 10);
  });

  it('should return the number of hours', () => {
    const result = evaluate('d.hours()', contextOptions);
    expect(result).toBeFormulaDataType(FormulaNumber, 12);
  });

  it('should return the number of minutes', () => {
    const result = evaluate('d.minutes()', contextOptions);
    expect(result).toBeFormulaDataType(FormulaNumber, 30);
  });

  it('should return the number of seconds', () => {
    const result = evaluate('d.seconds()', contextOptions);
    expect(result).toBeFormulaDataType(FormulaNumber, 15);
  });

  it('should return an error when calling a method with arguments', () => {
    expect(() => evaluate('d.years(1)', contextOptions)).toThrowFormulaError(
      'Expected 0 argument(s).',
      [2, 7],
    );
  });
});
