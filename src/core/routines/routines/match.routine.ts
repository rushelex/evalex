import type { ProcessedArgument } from '../arguments';

import { FormulaArray, FormulaRegExp, FormulaString, Kind } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaString, 'match', {
  description: 'Returns an array of all matches found by the regular expression.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello 42 world 101"', '"\\\\d+"', '"g"'),
      result: () => new FormulaArray([new FormulaString('42'), new FormulaString('101')]),
    },
    {
      formula: (name) => name('"test@example.com"', '"@"'),
      result: () => new FormulaArray([new FormulaString('@')]),
    },
  ]),
  arguments: createRoutineArguments([
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.String, { name: 'pattern' }),
      new Argument(Kind.String, { name: 'flags', optional: true }),
    ],
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.RegExp, { name: 'regexp' }),
    ],
  ]),
  handler: ({ instance, args, location, visitor }) => {
    try {
      const [patternOrRegExpArg, flagsArg] = args as [ProcessedArgument<FormulaString>, ProcessedArgument<FormulaString>?] | [ProcessedArgument<FormulaRegExp>];

      const regexp = FormulaRegExp.from(patternOrRegExpArg.dataType.value, flagsArg?.dataType.value);

      const matches = instance.value.match(regexp.toRegExp());
      if (!matches) {
        return new FormulaArray([], 'string');
      }

      return new FormulaArray(matches.map((match) => new FormulaString(match)));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});
