import type { ProcessedArgument } from '../arguments';

import { FormulaArray, FormulaRegExp, FormulaString, Kind } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('match', {
  on: [FormulaString],
  description: 'Returns all matches of the regular expression as a list.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Order 123 Order 456"', '"\\\\d+"'),
      result: () => new FormulaArray([new FormulaString('123'), new FormulaString('456')]),
    },
    {
      formula: (name) => name('"Hi hi"', '/hi/i'),
      result: () => new FormulaArray([new FormulaString('Hi'), new FormulaString('hi')]),
    },
    {
      formula: (name) => name('"test@example.com"', '"@"'),
      result: () => new FormulaArray([new FormulaString('@')]),
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

      let regex = regexp.toRegExp();

      // Every match is returned regardless of the global flag, without capture groups
      if (!regex.global) {
        regex = new RegExp(regex.source, `g${regex.flags}`);
      }

      const matches = Array.from(subject.value.matchAll(regex), (match) => new FormulaString(match[0]));
      if (!matches.length) {
        return new FormulaArray([], 'string');
      }

      return new FormulaArray(matches);
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});
