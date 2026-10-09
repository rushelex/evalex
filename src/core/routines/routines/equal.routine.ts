import type { ProcessedArgument } from '../arguments';

import {
  FormulaBoolean,
  Kind,
} from '../../data-types';
import { ALL_DATA_TYPES } from '../all-data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('equal', {
  on: ALL_DATA_TYPES,
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
  handler: ({ subject, args }) => {
    const [bArg] = args as [ProcessedArgument<FormulaBoolean>];
    const result = subject.value === bArg.dataType.value;
    return new FormulaBoolean(result);
  },
});
