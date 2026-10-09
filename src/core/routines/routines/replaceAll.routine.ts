import type { ProcessedArgument } from '../arguments';

import { FormulaRegExp, FormulaString, Kind } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaString, 'replaceAll', {
  description: 'Replaces every match with the replacement string.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello 123 world 456"', '"\\\\d+"', '"XXX"'),
      result: () => new FormulaString('Hello XXX world XXX'),
    },
    {
      formula: (name) => name('"Hello HELLO"', '/hello/i', '"hi"'),
      result: () => new FormulaString('hi hi'),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument(Kind.String, { name: 'self' }),
    new Argument([Kind.String, Kind.RegExp], { name: 'pattern' }),
    new Argument(Kind.String, { name: 'replacement' }),
  ]),
  handler: ({ instance, args, location, visitor }) => {
    try {
      const [patternArg, replacementArg] = args as [ProcessedArgument<FormulaString | FormulaRegExp>, ProcessedArgument<FormulaString>];

      const regexp = patternArg.dataType instanceof FormulaRegExp ? patternArg.dataType : new FormulaRegExp(patternArg.dataType.value);

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
