import { FormulaBoolean, FormulaRegExp } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('test', {
  description: 'Tests whether the string matches the regular expression.',
  examples: [
    {
      formula: (name) => name('"Hello 123"', '/\\d+/'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"Hello"', '/hello/i'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"Hello world"', '"\\\\d+"'),
      result: () => new FormulaBoolean(false),
    },
  ],
  arguments: [
    arg.string('text'),
    arg.pattern('pattern'),
  ],
  returns: type.boolean,
  handler: ({ subject, args: [pattern], location, visitor }) => {
    try {
      const regexp = pattern instanceof FormulaRegExp ? pattern : new FormulaRegExp(pattern.value);

      return new FormulaBoolean(regexp.toRegExp().test(subject.value));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});
