import type { FormulaDataType } from '../data-types';
import type { FormulaType } from './formula-type';

import { FormulaArray, Kind } from '../data-types';
import { kindsOf } from './kinds-of';
import { membersOf } from './members-of';

/**
 * Tells whether a call takes `value` where it declares `formulaType`: by the kind of the value, see {@link kindsOf}, and
 * for a nested type by the kinds of the items of its lists, at any depth.
 */
export function admits({ formulaType, value }: { readonly formulaType: FormulaType; readonly value: FormulaDataType }): boolean {
  return membersOf(formulaType).some((member) => {
    if (member.kind === 'Nested') {
      return FormulaArray.isOfType(value) ? value.value.every((item) => admits({ formulaType: member, value: item })) : admits({ formulaType: member.items, value });
    }

    const kinds = kindsOf(member);

    return kinds.includes(Kind.Any) || kinds.includes(value.kind);
  });
}
