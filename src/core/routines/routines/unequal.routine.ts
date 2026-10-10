import { areEqual, FormulaBoolean } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('unequal', {
  description: 'Returns false if both values are equal and true otherwise.',
  examples: [
    {
      formula: (name) => name('1', '2'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('[1]', '[1]'),
      result: () => new FormulaBoolean(false),
    },
  ],
  arguments: [arg.any('a'), arg.any('b')],
  handler: ({ subject, args: [other] }) => new FormulaBoolean(!areEqual(subject, other)),
});
