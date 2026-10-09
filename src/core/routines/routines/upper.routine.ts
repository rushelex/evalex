import { FormulaString } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('upper', {
  description: 'Converts the string to uppercase.',
  examples: [
    {
      formula: (name) => name('"hello"'),
      result: () => new FormulaString('HELLO'),
    },
  ],
  arguments: [arg.string('text')],
  handler: ({ subject }) => new FormulaString(subject.value.toUpperCase()),
});
