import type { ProcessedArgument } from '../arguments';

import { FormulaBoolean, FormulaRegExp, FormulaString, Kind } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('test', {
  on: [FormulaString],
  description: 'Tests whether the string matches the regular expression.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello 123"', '/\\d+/'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"Hello"', '/hello/i'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"Hello world"', '"\\\\d+"'),
      result: () => new FormulaBoolean(false),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument(Kind.String, { name: 'text' }),
    new Argument([Kind.String, Kind.RegExp], { name: 'pattern' }),
  ]),
  handler: ({ subject, args, location, visitor }) => {
    try {
      const [patternArg] = args as [ProcessedArgument<FormulaString | FormulaRegExp>];

      const regexp = patternArg.dataType instanceof FormulaRegExp ? patternArg.dataType : new FormulaRegExp(patternArg.dataType.value);

      return new FormulaBoolean(regexp.toRegExp().test(subject.value));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});
