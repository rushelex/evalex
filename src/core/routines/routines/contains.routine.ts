import { FormulaBoolean, FormulaString } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('contains', {
  description: 'Tests whether the string contains the text or a regex match.',
  examples: [
    {
      formula: (name) => name('"Hello world"', '"wor"'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"v1.2"', '"."'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"v1.2"', '/\\d\\.\\d/'),
      result: () => new FormulaBoolean(true),
    },
  ],
  arguments: [
    arg.string('text'),
    arg.pattern('search'),
  ],
  handler: ({ subject, args: [search] }) => {
    // A string argument is plain text, so regex metacharacters like "." match literally
    if (search instanceof FormulaString) {
      return new FormulaBoolean(subject.value.includes(search.value));
    }

    return new FormulaBoolean(search.toRegExp().test(subject.value));
  },
});
