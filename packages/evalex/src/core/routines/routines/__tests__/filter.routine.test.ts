import { evaluate, loc } from '../../../../testing-library';
import { FormulaArray, FormulaNumber, FormulaObject, FormulaString } from '../../../data-types';
import { Errors } from '../../../errors';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('filter');

describe('filter routine', tester.examples([
  {
    formula: 'numbers.filter(current % 2 == 0)',
    context: {
      numbers: new FormulaArray([
        new FormulaNumber(1),
        new FormulaNumber(2),
        new FormulaNumber(3),
      ]),
    },
    expected: new FormulaArray([
      new FormulaNumber(2),
    ]),
  },
  {
    formula: 'persons.filter(current.name() == "Alice")',
    context: {
      persons: new FormulaArray([
        FormulaObject.from({ id: 'u1', name: 'Alice', age: 30 }),
        FormulaObject.from({ id: 'u2', name: 'Bob', age: 24 }),
        FormulaObject.from({ id: 'u3', name: 'Charlie', age: 35 }),
      ]),
    },
    expected: new FormulaArray([
      new FormulaObject({
        id: new FormulaString('u1'),
        name: new FormulaString('Alice'),
        age: new FormulaNumber(30),
      }),
    ]),
  },
  {
    formula: 'empty.filter(current + 1)',
    context: {
      empty: new FormulaArray([], 'number'),
    },
    expected: new FormulaArray([]),
  },
  {
    formula: 'numbers.filter(current + index == 3)',
    context: {
      numbers: new FormulaArray([
        new FormulaNumber(1),
        new FormulaNumber(2),
        new FormulaNumber(3),
      ]),
    },
    expected: new FormulaArray([
      new FormulaNumber(2),
    ]),
  },
  {
    formula: 'numbers.filter(current + 1)',
    context: {
      numbers: new FormulaArray([new FormulaNumber(1)]),
    },
    expected: {
      function: {
        message: 'Expected callback to return type Boolean, but got Number.',
        location: [16, 27],
      },
      method: {
        message: 'Expected callback to return type Boolean, but got Number.',
        location: [15, 26],
      },
    },
  },
]));

describe('filter predicate result', () => {
  it('should throw CallbackReturnTypeMismatch for the predicate argument when it returns a non-boolean', () => {
    const error = catchError(() => evaluate('filter([1], 2)'));

    expect(Errors.Argument.CallbackReturnTypeMismatch.is(error)).toBe(true);
    expect(error).toMatchObject({
      code: 'ARGUMENT_TYPE_MISMATCH',
      payload: { expected: ['Boolean'], actual: 'Number', argumentPosition: 2, argumentName: 'predicate' },
      location: loc(12, 13),
    });
  });
});

// Helpers

function catchError(fn: () => unknown): unknown {
  try {
    fn();
  }
  catch (error) {
    return error;
  }

  throw new Error('Expected the formula to throw.');
}
