import type { FormulaDataType } from '../../data-types';
import type { RoutineExampleOptions } from '../routine-example';

import { FormulaArray, FormulaNumber, Kind } from '../../data-types';
import { Errors } from '../../errors';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaNumber(6),
  },
  {
    formula: (name) => name('1', '2', '3'),
    result: () => new FormulaNumber(6),
  },
  {
    formula: (name) => name('1', '[2, 3, [4, 5]]'),
    result: () => new FormulaNumber(15),
  },
];

routinesRegistry.registerRoutine('sum', {
  description: 'Returns the sum of its arguments.',
  examples: routineExamples,
  arguments: [arg.oneOf('numbers', [Kind.Array, Kind.Number], { repeatable: true })],
  handler: ({ subject, args, location }) => {
    const values = [subject, ...args].flatMap(flatten);

    if (values.some((value) => !(value instanceof FormulaNumber))) {
      throw Errors.Argument.AllMustBeNumbers.create({
        actual: values.map((value) => typeof value.value).join(', '),
      }, {
        location,
      });
    }

    const numbers = values as FormulaNumber[];

    if (numbers.some((number) => !Number.isFinite(number.value))) {
      throw Errors.Argument.AllMustBeFinite.create({
        actual: numbers.map((number) => String(number.value)).join(', '),
      }, {
        location,
      });
    }

    return new FormulaNumber(numbers.reduce((total, number) => total + number.value, 0));
  },
});

function flatten(value: FormulaDataType): FormulaDataType[] {
  return FormulaArray.isOfType(value) ? FormulaArray.flatValues(value) : [value];
}
