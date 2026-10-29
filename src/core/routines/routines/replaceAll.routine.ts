import { FormulaRegExp, FormulaString } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('replaceAll', {
  description: 'Replaces every match with the replacement string.',
  examples: [
    {
      formula: (name) => name('"Hello 123 world 456"', '"\\\\d+"', '"XXX"'),
      result: () => new FormulaString('Hello XXX world XXX'),
    },
    {
      formula: (name) => name('"Hello HELLO"', '/hello/i', '"hi"'),
      result: () => new FormulaString('hi hi'),
    },
  ],
  arguments: [
    arg.string('text'),
    arg.pattern('pattern'),
    arg.string('replacement'),
  ],
  returns: type.string,
  handler: ({ subject, args: [pattern, replacement], location, visitor }) => {
    try {
      const regexp = pattern instanceof FormulaRegExp ? pattern : new FormulaRegExp(pattern.value);

      let regex = regexp.toRegExp();

      // Ensure global flag for replaceAll
      if (!regex.global) {
        regex = new RegExp(regex.source, `g${regex.flags}`);
      }

      return new FormulaString(subject.value.replace(regex, replacement.value));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});
