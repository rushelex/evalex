import type { RoutineExampleOptions } from '../routine-example';

import { FormulaBoolean } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('1234'),
    result: () => new FormulaBoolean(false),
  },
  {
    formula: (name) => name('0'),
    result: () => new FormulaBoolean(true),
  },
  {
    formula: (name) => name('[]'),
    result: () => new FormulaBoolean(true),
  },
];

routinesRegistry.registerRoutine('empty', {
  description: 'Returns true if the value is empty: 0, "", false or [].',
  examples: routineExamples,
  arguments: [
    arg.any('value'),
  ],
  returns: type.boolean,
  handler: ({ subject }) => new FormulaBoolean(subject.isEmpty()),
});
