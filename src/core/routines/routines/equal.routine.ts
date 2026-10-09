import type { Class } from 'type-fest';

import type { FormulaDataType } from '../../data-types';
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

const DATA_TYPES: ReadonlyArray<Class<FormulaDataType>> = [
  FormulaArray,
  FormulaBoolean,
  FormulaDate,
  FormulaDuration,
  FormulaNull,
  FormulaNumber,
  FormulaObject,
  FormulaRegExp,
  FormulaString,
];

for (const dataType of DATA_TYPES) {
  routinesRegistry.registerMethod(dataType, 'equal', {
    description: 'Returns true if both values are equal and false otherwise.',
    examples: createRoutineExamples([
      {
        formula: (name) => name('1', '1'),
        result: () => new FormulaBoolean(true),
      },
      {
        formula: (name) => name('"1"', '"1"'),
        result: () => new FormulaBoolean(true),
      },
    ]),
    arguments: createRoutineArguments([
      new Argument(Kind.Any, { name: 'a' }),
      new Argument(Kind.Any, { name: 'b' }),
    ]),
    handler: ({ instance, args }) => {
      const [bArg] = args as [ProcessedArgument<FormulaBoolean>];
      const result = instance.value === bArg.dataType.value;
      return new FormulaBoolean(result);
    },
  });
}
