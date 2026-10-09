import type { ProcessedArgument } from '../arguments';

import { FormulaArray, FormulaRegExp, FormulaString, Kind } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaString, 'match', {
  description: 'Returns all matches of the regular expression as a list.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Notion 123 Notion 456"', '"\\\\d+"'),
      result: () => new FormulaArray([new FormulaString('123'), new FormulaString('456')]),
    },
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

      let regex = regexp.toRegExp();

      // Notion returns every match regardless of the global flag, without capture groups
      if (!regex.global) {
        regex = new RegExp(regex.source, `g${regex.flags}`);
      }

      const matches = Array.from(instance.value.matchAll(regex), (match) => new FormulaString(match[0]));
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
