import type { FormulaDataType } from '../../data-types';
import type { ProcessedArgument } from '../arguments';

import { FormulaArray, FormulaNumber, Kind } from '../../data-types';
import { Errors } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
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
]);

routinesRegistry.registerRoutine('sum', {
  on: [FormulaArray, FormulaNumber],
  description: 'Returns the sum of its arguments.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument([Kind.Array, Kind.Number], { name: 'numbers', repeatable: true }),
  ]),
  handler: ({ subject, args, location }) => {
    const values = [subject, ...(args as ProcessedArgument[]).map((arg) => arg.dataType)].flatMap(flatten);

    if (values.some((value) => !(value instanceof FormulaNumber))) {
      throw Errors.Argument.AllMustBeNumbers.create({
        actual: values.map((value): string => typeof value.value).join(', '),
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
