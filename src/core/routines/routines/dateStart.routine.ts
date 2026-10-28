import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDateRange, FormulaDateTime } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('dateRange(parseDate("2022-09-07"), parseDate("2023-09-07"))'),
    result: () => FormulaDateTime.from('2022-09-07'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")'),
    result: () => FormulaDateTime.from('2023-08-30'),
  },
];

routinesRegistry.registerRoutine({ function: 'dateStart', method: ['start', 'dateStart'] }, {
  description: 'Returns the start of the date range; a date is its own start.',
  examples: routineExamples,
  arguments: [[arg.dateRange('range')], [arg.dateTime('date')]],
  handler: ({ subject }) => (subject instanceof FormulaDateRange ? new FormulaDateTime(subject.value.start) : subject),
});
