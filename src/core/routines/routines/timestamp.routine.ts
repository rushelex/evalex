import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('parseDate("2023-07-10T21:35Z")'),
    result: () => new FormulaNumber(1689024900000),
  },
];

routinesRegistry.registerRoutine('timestamp', {
  description: 'Returns the Unix timestamp of the date in milliseconds.',
  examples: routineExamples,
  arguments: [arg.dateTime('date')],
  handler: ({ subject }) => new FormulaNumber(subject.value.epochMilliseconds),
});
