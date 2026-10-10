import type { FormulaDataType } from '../../data-types';

import { fc } from '@fast-check/vitest';

import { formulaValueArbitrary } from '../../../testing-library';
import { FormulaArray } from '../../data-types';

interface ListCondition {
  readonly context: Readonly<{ list: FormulaDataType; value: FormulaDataType }>;
  /** Condition over `current` and `index` that holds a Boolean for every item and never fails. */
  readonly condition: string;
}

const CONDITIONS = ['true', 'false', 'current == value', 'index >= 2', 'index % 2 == 0', 'empty(current)', 'current == value or index == 1'];

/**
 * A list, a value and a condition over the list items, to check a list routine against `filter` with the same condition.
 *
 * @remarks
 * The value is one of the items half of the time, so conditions comparing with it match as often as they miss.
 */
export function listConditionArbitrary(): fc.Arbitrary<ListCondition> {
  return fc.array(formulaValueArbitrary(), { maxLength: 5 }).chain((items) => fc.record({
    context: fc.record({
      list: fc.constant(new FormulaArray(items)),
      value: items.length === 0 ? formulaValueArbitrary() : fc.oneof(fc.constantFrom(...items), formulaValueArbitrary()),
    }),
    condition: fc.constantFrom(...CONDITIONS),
  }));
}
