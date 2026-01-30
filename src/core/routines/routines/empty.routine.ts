import type { Class } from 'type-fest';

import type {
  FormulaDataType,
} from '../../data-types';
import type { ProcessedArgument } from '../arguments';

import {
  FormulaArray,
  FormulaBoolean,
  FormulaDate,
  FormulaDuration,
  FormulaNull,
  FormulaNumber,
  FormulaObject,
  FormulaRegExp,
  FormulaString,
  Kind,
} from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const description = 'Returns true if the value is empty. 0, “”, false, and [] are considered empty.';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('1234'),
    result: () => new FormulaBoolean(false),
  },
  {
    formula: (name) => name('0'),
    result: () => new FormulaBoolean(true),
  },
  {
    formula: (name) => name('[]'),
    result: () => new FormulaBoolean(true),
  },
]);

const routineArguments = createRoutineArguments([
  new Argument(Kind.Any, { name: 'value' }),
]);

routinesRegistry.registerFunction('empty', {
  description,
  examples: routineExamples,
  arguments: routineArguments,
  handler: ({ args }) => {
    const [valueArg] = args as [ProcessedArgument<FormulaBoolean>];
    return new FormulaBoolean(valueArg.dataType.isEmpty());
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
  routinesRegistry.registerMethod(DataType as Class<FormulaDataType>, 'empty', {
    description,
    examples: routineExamples,
    arguments: routineArguments,
    handler: ({ instance }) => new FormulaBoolean(instance.isEmpty()),
  });
}
