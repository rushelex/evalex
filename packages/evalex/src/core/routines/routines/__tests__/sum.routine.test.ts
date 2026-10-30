import { evaluateOutcome } from '../../../../testing-library';
import { FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('sum');

describe('sum routine', tester.examples([
  {
    formula: 'sum(1, 2, 3)',
    expected: new FormulaNumber(6),
  },
  {
    formula: 'sum(1)',
    expected: new FormulaNumber(1),
  },
  {
    formula: 'sum(0)',
    expected: new FormulaNumber(0),
  },
  {
    formula: 'sum(-1)',
    expected: new FormulaNumber(-1),
  },
  {
    formula: '1.sum(2)',
    expected: new FormulaNumber(3),
  },
  {
    formula: '1.sum(2, 3)',
    expected: new FormulaNumber(6),
  },
  {
    formula: '1.sum([2, 3])',
    expected: new FormulaNumber(6),
  },
  {
    formula: '1.sum([])',
    expected: new FormulaNumber(1),
  },
  {
    formula: '1.sum([2, 3, [4, 5]])',
    expected: new FormulaNumber(15),
  },
  {
    formula: '[1, 2, 3].sum()',
    expected: new FormulaNumber(6),
  },
  {
    formula: '[1, [2, 3, [4, 5]]].sum()',
    expected: new FormulaNumber(15),
  },
  {
    formula: 'sum("1", 2, 3)',
    expected: {
      function: {
        message: 'Expected type Number, or lists of it.',
        location: [4, 7],
      },
    },
  },
  {
    formula: 'sum([1, 2], "3", 4, 5)',
    expected: {
      function: {
        message: 'Expected type Number, or lists of it.',
        location: [12, 15],
      },
    },
  },
  {
    formula: 'sum(1, "2", 3)',
    expected: {
      function: {
        message: 'Expected type Number, or lists of it.',
        location: [7, 10],
      },
    },
  },
  {
    formula: '["a", 1].sum()',
    expected: {
      function: {
        message: 'Expected type Number, or lists of it.',
        location: [4, 12],
      },
      method: {
        message: 'Expected type Number, or lists of it.',
        location: [9, 12],
      },
    },
  },
]));

describe('sum of a list holding a value that is not a number', () => {
  it.each([
    { formula: 'sum(1, [2, [true, "a"]])', argumentPosition: 2 },
    { formula: '[2, [true, "a"]].sum()', argumentPosition: 0 },
  ])('should name the kind of the first such value at any depth: $formula', ({ formula, argumentPosition }) => {
    const outcome = evaluateOutcome(formula);

    expect('error' in outcome && outcome.error.payload).toEqual({ expected: ['Number'], actual: 'Boolean', argumentPosition });
  });
});
