import type { Class } from 'type-fest';

import type { ProcessedArgument } from '../routines/arguments';
import type { FormulaDataType } from './FormulaDataType';

import { Argument, createRoutineArguments } from '../routines/arguments';
import { routinesRegistry } from '../routines/registry';
import { createRoutineExamples } from '../routines/routine-examples';
import { FormulaBoolean } from './boolean';
import { Kind } from './kind';

/**
 * Defines core methods for a specific data type.
 * @param subject The constructor of the data type where the core methods are being registered.
 */
export function defineCoreMethods(subject: Class<FormulaDataType>): void {
  routinesRegistry.registerMethod(subject, 'equal', {
    description: 'Returns true if both values are equal and false otherwise.',
    examples: createRoutineExamples([
      {
        formula: (name) => name('1', '1'),
        result: () => new FormulaBoolean(true),
      },
      {
        formula: (name) => name('"1"', '"1"'),
        result: () => new FormulaBoolean(false),
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
