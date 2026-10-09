import {
  FormulaBoolean,
} from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('equal', {
  description: 'Returns true if both values are equal and false otherwise.',
  examples: [
    {
      formula: (name) => name('1', '1'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"1"', '"1"'),
      result: () => new FormulaBoolean(true),
    },
  ],
  arguments: [arg.any('a'), arg.any('b')],
  handler: ({ subject, args: [other] }) => new FormulaBoolean(subject.value === other.value),
});
