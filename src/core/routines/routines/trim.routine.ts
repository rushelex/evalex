import { FormulaString } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('trim', {
  description: 'Returns the string with leading and trailing whitespace removed.',
  examples: [
    {
      formula: (name) => name('"  hello  "'),
      result: () => new FormulaString('hello'),
    },
  ],
  arguments: [arg.string('text')],
  handler: ({ subject }) => new FormulaString(subject.value.trim()),
});
