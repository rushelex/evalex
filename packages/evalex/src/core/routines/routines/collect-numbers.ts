import type { FormulaDataType } from '../../data-types';

import { FormulaArray, FormulaNumber } from '../../data-types';

/**
 * The numbers of the arguments of an aggregate routine such as `sum` or `min`, with nested lists flattened at any depth.
 *
 * @remarks
 * The call has checked that every value is a number or a list of them, as the routine declares them with `type.nested`.
 * Empty when every argument is an empty list.
 */
export function collectNumbers(values: readonly FormulaDataType[]): FormulaNumber[] {
  return values.flatMap((value) => (FormulaArray.isOfType(value) ? FormulaArray.flatValues(value) : [value])).filter((item) => item instanceof FormulaNumber);
}
