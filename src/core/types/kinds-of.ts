import type { FormulaType } from './formula-type';

import { Kind } from '../data-types';

/**
 * The kinds of the values a type admits, as a call checks its arguments: the items of a list and the binding of a
 * variable are left to the routine, so a list of any items and a variable admit any value of their kind.
 */
export function kindsOf(formulaType: FormulaType): readonly Kind[] {
  if (formulaType.kind === 'Union') {
    return formulaType.of.flatMap(kindsOf);
  }

  return formulaType.kind === 'Variable' ? [Kind.Any] : [formulaType.kind];
}
