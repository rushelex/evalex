import { FormulaArray, FormulaRegExp, FormulaString } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('match', {
  description: 'Returns all matches of the regular expression as a list.',
  examples: [
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
  ],
  arguments: [
    arg.string('text'),
    arg.pattern('pattern'),
  ],
  returns: type.array(type.string),
  handler: ({ subject, args: [pattern], location, visitor }) => {
    try {
      const regexp = pattern instanceof FormulaRegExp ? pattern : new FormulaRegExp(pattern.value);

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
