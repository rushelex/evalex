import type { FormulaType } from './formula-type';

import { Kind } from '../data-types';
import { membersOf } from './members-of';

/**
 * The type of a value of any of `types`, in the shortest form: nested unions flattened, equal members once, `Any` in
 * place of the whole when it is a member, and a lone member as itself.
 *
 * @remarks
 * No types give a union of nothing, the type no value has, as the items of an empty list.
 */
export function unionOf(types: readonly FormulaType[]): FormulaType {
  const members = new Map<string, FormulaType>();

  for (const member of types.flatMap(membersOf)) {
    if (member.kind === Kind.Any) {
      return member;
    }

    members.set(JSON.stringify(member), member);
  }

  return members.size === 1 ? [...members.values()][0] : { kind: 'Union', of: [...members.values()] };
}
