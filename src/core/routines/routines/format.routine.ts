import type { RoutineExampleOptions } from '../routine-example';

import { FormulaString } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('1234'),
    result: () => new FormulaString('1234'),
  },
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaString('1, 2, 3'),
  },
];

routinesRegistry.registerRoutine('format', {
  description: 'Returns the value formatted as text.',
  examples: routineExamples,
  arguments: [arg.any('value')],
  handler: ({ subject }) => new FormulaString(subject.toString()),
});
