import type { FormulaDataType } from '../../data-types';
import type { RoutineExampleOptions } from '../routine-example';

import { Temporal } from 'temporal-polyfill';

import { FormulaArray, FormulaDate, FormulaNumber, FormulaString } from '../../data-types';
import { Errors } from '../../errors';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[3, 1, 2]'),
    result: () => FormulaArray.from([1, 2, 3]),
  },
  {
    formula: (name) => name('["ccc", "a", "bb"]', 'length(current)'),
    result: () => FormulaArray.from(['a', 'bb', 'ccc']),
  },
  {
    formula: (name) => name('[1, "a"]'),
    error: {
      type: Errors.Evaluation.ComparisonTypeMismatch,
      message: 'Types must match for comparison (Number, String, or Date).',
      location: { function: [0, 14], method: [9, 13] },
    },
  },
];

routinesRegistry.registerRoutine('sort', {
  description: 'Returns the list in ascending order, optionally by a key.',
  examples: routineExamples,
  arguments: [arg.array('list'), arg.eachItem('key', { optional: true })],
  handler: ({ subject, args: [key], locations, location, visitor }) => {
    const keys = key === undefined
      ? subject.value
      : subject.value.map((current, index) => key.execute({ current, index: new FormulaNumber(index) }));
    const order = sortOrder(keys);

    if (order === undefined) {
      throw Errors.Evaluation.ComparisonTypeMismatch.create({ expression: visitor.formula }, { location: key === undefined ? location : locations[0] });
    }

    return new FormulaArray(order.map((index) => subject.value[index]));
  },
});

/** Positions of the keys in the order of `<`, keeping equal keys in place; `undefined` when `<` cannot compare them all. */
function sortOrder(keys: readonly FormulaDataType[]): number[] | undefined {
  if (keys.every((key): key is FormulaNumber => key instanceof FormulaNumber)) {
    return orderBy(keys.map((key) => key.value), compareValues);
  }

  if (keys.every((key): key is FormulaString => key instanceof FormulaString)) {
    return orderBy(keys.map((key) => key.value), compareValues);
  }

  if (keys.every((key): key is FormulaDate => key instanceof FormulaDate)) {
    return orderBy(keys.map((key) => key.value), (a, b) => Temporal.ZonedDateTime.compare(a, b));
  }

  return undefined;
}

function orderBy<T>(values: readonly T[], compare: (a: T, b: T) => number): number[] {
  return values.map((_, index) => index).toSorted((a, b) => compare(values[a], values[b]));
}

function compareValues<T extends number | string>(a: T, b: T): number {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}
