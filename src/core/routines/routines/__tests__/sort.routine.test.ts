import type { FormulaDataType } from '../../../data-types';

import { fc, it } from '@fast-check/vitest';

import { evaluate, evaluateOutcome, formulaValueArbitrary } from '../../../../testing-library';
import { FormulaArray, FormulaBoolean, FormulaDateTime, Kind } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('sort');

// Lists of the kinds `<` compares, which sort without a key.
const comparableList = fc.constantFrom(Kind.Number, Kind.String, Kind.DateTime)
  .chain((kind) => fc.array(formulaValueArbitrary(kind), { maxLength: 6 }))
  .map((items) => new FormulaArray(items));

describe('sort routine', () => {
  it.prop([comparableList])('should put no item before a smaller one', (list) => {
    const sorted = evaluate('sort(list)', { context: { list } });

    expect(evaluate('every(slice(sorted, 1), not (current < at(sorted, index)))', { context: { sorted } }))
      .toBeFormulaDataType(FormulaBoolean, true);
  });

  it.prop([comparableList])('should keep every item of the list, each as many times', (list) => {
    expect(itemTexts(evaluate('sort(list)', { context: { list } }))).toEqual(itemTexts(list));
  });

  it.prop([comparableList])('should order by the items themselves when the key is the item', (list) => {
    const context = { list };

    expect(evaluateOutcome('sort(list, current)', { context })).toHaveSameOutcomeAs(evaluateOutcome('sort(list)', { context }));
  });

  it.prop([formulaValueArbitrary(Kind.Array)])('should keep items with equal keys in their order', (list) => {
    const context = { list };

    expect(evaluateOutcome('sort(list, 0)', { context })).toHaveSameOutcomeAs(evaluateOutcome('list', { context }));
    expect(evaluateOutcome('sort(list, -index)', { context })).toHaveSameOutcomeAs(evaluateOutcome('reverse(list)', { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '["b", "a", "B"].sort()',
      expected: FormulaArray.from(['B', 'a', 'b']),
    },
    {
      formula: 'dates.sort()',
      context: { dates: new FormulaArray([FormulaDateTime.from('2024-07-28'), FormulaDateTime.from('2023-01-01')]) },
      expected: new FormulaArray([FormulaDateTime.from('2023-01-01'), FormulaDateTime.from('2024-07-28')]),
    },
    {
      formula: 'values.sort(current % 2)',
      context: { values: FormulaArray.from(Array.from({ length: 40 }, (_, index) => 40 - index)) },
      expected: FormulaArray.from([
        ...Array.from({ length: 20 }, (_, index) => 40 - index * 2),
        ...Array.from({ length: 20 }, (_, index) => 39 - index * 2),
      ]),
    },
    {
      formula: '[].sort()',
      expected: FormulaArray.from([]),
    },
    {
      formula: '[true, false].sort()',
      expected: {
        function: {
          message: 'Types must match for comparison (Number, String, or Date).',
          location: [0, 19],
        },
        method: {
          message: 'Types must match for comparison (Number, String, or Date).',
          location: [14, 18],
        },
      },
    },
    {
      formula: '[1, 2].sort(if(current > 1, "a", 0))',
      expected: {
        function: {
          message: 'Types must match for comparison (Number, String, or Date).',
          location: [13, 36],
        },
        method: {
          message: 'Types must match for comparison (Number, String, or Date).',
          location: [12, 35],
        },
      },
    },
  ]));
});

/** Text of each item, in a fixed order, to compare which items two lists hold regardless of their order. */
function itemTexts(list: FormulaDataType): string[] {
  return FormulaArray.isOfType(list) ? list.value.map((item) => item.toString({ asJSON: true })).toSorted() : [];
}
