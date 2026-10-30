import type { FormulaValue } from './data-types';
import type { FormulaError } from './errors';

/**
 * A call of a routine, as an editor shows it next to the description: the formula with the value it returns, or with the
 * error it fails with.
 *
 * @remarks
 * The value is computed by the scope that lists the routine, with its time zone and formatters, so an example of a
 * routine that reads the current time shows the current time.
 */
export type FormulaRoutineExample
  = | { readonly formula: string; readonly result: FormulaValue }
    | { readonly formula: string; readonly error: FormulaError };
