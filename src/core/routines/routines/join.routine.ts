import type { RoutineExampleOptions } from '../routine-example';

import { FormulaString } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('["a", "b", "c"]'),
    result: () => new FormulaString('abc'),
  },
  {
    formula: (name) => name('["a", "b", "c"]', '", "'),
    result: () => new FormulaString('a, b, c'),
  },
  {
    formula: (name) => name('["a", "b", "c"]', '""'),
    result: () => new FormulaString('abc'),
  },
];

routinesRegistry.registerRoutine('join', {
  description: 'Returns the values of the list joined with the joiner.',
  examples: routineExamples,
  arguments: [
    arg.array('list'),
    arg.string('separator', { optional: true }),
  ],
  handler: ({ subject, args: [separator] }) => new FormulaString(
    subject.value
      .map((item) => item.toString())
      .join(separator?.value ?? ''),
  ),
});
