import type { ProcessedArgument } from '../arguments';

import { FormulaRegExp, FormulaString, Kind } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaString, 'replace', {
  description: 'Replaces the first match, or every match with the "g" flag.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello world"', '"world"', '"universe"'),
      result: () => new FormulaString('Hello universe'),
    },
    {
      formula: (name) => name('"Hello 123 world 456"', '"\\\\d+"', '"XXX"'),
      result: () => new FormulaString('Hello XXX world 456'),
    },
    {
      formula: (name) => name('"Hello 123 world 456"', '/\\d+/g', '"XXX"'),
      result: () => new FormulaString('Hello XXX world XXX'),
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

      const replacement = replacementArg.dataType.value;

      return new FormulaString(instance.value.replace(regexp.toRegExp(), replacement));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});
