import { FormulaString } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('lower', {
  description: 'Converts the string to lowercase.',
  examples: [
    {
      formula: (name) => name('"HELLO"'),
      result: () => new FormulaString('hello'),
    },
  ],
  arguments: [arg.string('text')],
  returns: type.string,
  handler: ({ subject }) => new FormulaString(subject.value.toLowerCase()),
});
