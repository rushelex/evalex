import { FormulaRegExp, FormulaString } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('replace', {
  description: 'Replaces the first match, or every match with the "g" flag.',
  examples: [
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
  ],
  arguments: [
    arg.string('text'),
    arg.pattern('pattern'),
    arg.string('replacement'),
  ],
  handler: ({ subject, args: [pattern, replacement], location, visitor }) => {
    try {
      const regexp = pattern instanceof FormulaRegExp ? pattern : new FormulaRegExp(pattern.value);

      return new FormulaString(subject.value.replace(regexp.toRegExp(), replacement.value));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});
