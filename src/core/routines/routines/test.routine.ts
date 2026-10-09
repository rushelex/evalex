import type { ProcessedArgument } from '../arguments';

import { FormulaBoolean, FormulaRegExp, FormulaString, Kind } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaString, 'test', {
  description: 'Tests whether the string matches the regular expression.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello 123"', '"\\\\d+"'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"Hello world"', '"\\\\d+"'),
      result: () => new FormulaBoolean(false),
    },
  ]),
  arguments: createRoutineArguments([
    [
      new Argument(Kind.String, { name: 'self' }),
      new Argument(Kind.String, { name: 'pattern' }),
      new Argument(Kind.String, { name: 'flags', optional: true }),
    ],
    [
      new Argument(Kind.String, { name: 'self' }),
      new Argument(Kind.RegExp, { name: 'regexp' }),
    ],
  ]),
  handler: ({ instance, args, location, visitor }) => {
    try {
      const [patternOrRegExpArg, flagsArg] = args as [ProcessedArgument<FormulaString>, ProcessedArgument<FormulaString>?] | [ProcessedArgument<FormulaRegExp>];

      const regexp = FormulaRegExp.from(patternOrRegExpArg.dataType.value, flagsArg?.dataType.value);

      return new FormulaBoolean(regexp.toRegExp().test(instance.value));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});
