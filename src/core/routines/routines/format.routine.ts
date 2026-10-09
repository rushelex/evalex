import type { FormulaDataType } from '../../data-types';
import type { ProcessedArgument } from '../arguments';

import { FormulaArray, FormulaBoolean, FormulaDate, FormulaDuration, FormulaNull, FormulaNumber, FormulaObject, FormulaRegExp, FormulaString, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const description = 'Returns the value formatted as text.';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('1234'),
    result: () => new FormulaString('1234'),
  },
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaString('1, 2, 3'),
  },
]);

const routineArguments = createRoutineArguments([
  new Argument(Kind.Any, { name: 'value' }),
]);

routinesRegistry.registerFunction('format', {
  description,
  examples: routineExamples,
  arguments: routineArguments,
  handler: ({ args }) => {
    const [valueArg] = args as [ProcessedArgument<FormulaString>];
    return new FormulaString(valueArg.dataType.toString());
  },
});

for (const DataType of [
  FormulaArray,
  FormulaBoolean,
  FormulaDate,
  FormulaDuration,
  FormulaNull,
  FormulaNumber,
  FormulaObject,
  FormulaRegExp,
  FormulaString,
]) {
  routinesRegistry.registerMethod<FormulaDataType>(DataType, 'format', {
    description,
    examples: routineExamples,
    arguments: routineArguments,
    handler: ({ instance }) => new FormulaString(instance.toString()),
  });
}
