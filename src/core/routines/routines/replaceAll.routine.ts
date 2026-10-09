import type { ProcessedArgument } from '../arguments';

import { FormulaRegExp, FormulaString, Kind } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaString, 'replaceAll', {
  description: 'Replaces all matches of the regular expression with the replacement string.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello 123 world 456"', '"\\\\d+"', '"XXX"'),
      result: () => new FormulaString('Hello XXX world XXX'),
    },
  ]),
  arguments: createRoutineArguments([
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.String, { name: 'pattern' }),
      new Argument(Kind.String, { name: 'replacement' }),
      new Argument(Kind.String, { name: 'flags', optional: true }),
    ],
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.RegExp, { name: 'regexp' }),
      new Argument(Kind.String, { name: 'replacement' }),
    ],
  ]),
  handler: ({ instance, args, location, visitor }) => {
    try {
      const [patternOrRegExpArg, replacementArg, flagsArg] = args as [ProcessedArgument<FormulaString>, ProcessedArgument<FormulaString>, ProcessedArgument<FormulaString>?] | [ProcessedArgument<FormulaRegExp>, ProcessedArgument<FormulaString>];

      const regexp = FormulaRegExp.from(patternOrRegExpArg.dataType.value, flagsArg?.dataType.value);

      let regex = regexp.toRegExp();

      const replacement = replacementArg.dataType.value;

      // Ensure global flag for replaceAll
      if (!regex.global) {
        regex = new RegExp(regex.source, `g${regex.flags}`);
      }

      return new FormulaString(instance.value.replace(regex, replacement));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});
