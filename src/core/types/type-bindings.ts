import type { FormulaType } from './formula-type';

import { Kind } from '../data-types';
import { membersOf } from './members-of';
import { type } from './type';
import { unionOf } from './union-of';

/**
 * The types the variables of one signature stand for in one call, gathered from the types of its arguments.
 *
 * @remarks
 * A variable stands for every type bound to it, as `T` of `concat([1], ["a"])` stands for `Number` or `String`, and
 * for `Any` while nothing is bound to it, so a result typed with it never claims more than the call can return.
 */
export class TypeBindings {
  readonly #bound = new Map<string, FormulaType[]>();

  /** Binds the variables of `parameter` to the parts of `argument` in their place, as `T` of `Array<T>` to the items. */
  bind(parameter: FormulaType, argument: FormulaType): void {
    if (parameter.kind === 'Variable') {
      this.#bound.set(parameter.name, [...this.#bound.get(parameter.name) ?? [], argument]);

      return;
    }

    if (parameter.kind === 'Union') {
      for (const member of parameter.of) {
        this.bind(member, argument);
      }

      return;
    }

    if (parameter.kind === Kind.Array) {
      for (const member of membersOf(argument)) {
        if (member.kind === Kind.Array) {
          this.bind(parameter.items, member.items);
        }
        else if (member.kind === Kind.Any) {
          this.bind(parameter.items, type.any);
        }
      }
    }
  }

  /** The type with each variable replaced by what it stands for. */
  resolve(formulaType: FormulaType): FormulaType {
    if (formulaType.kind === 'Variable') {
      const bound = this.#bound.get(formulaType.name);

      return bound ? unionOf(bound) : type.any;
    }

    if (formulaType.kind === 'Union') {
      return unionOf(formulaType.of.map((member) => this.resolve(member)));
    }

    return formulaType.kind === Kind.Array ? { kind: Kind.Array, items: this.resolve(formulaType.items) } : formulaType;
  }
}
