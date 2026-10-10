import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDate, FormulaDateRange } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('dateRange(parseDate("2022-09-07"), parseDate("2023-09-07"))'),
    result: () => FormulaDate.from('2022-09-07'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")'),
    result: () => FormulaDate.from('2023-08-30'),
  },
];

routinesRegistry.registerRoutine({ function: 'dateStart', method: ['start', 'dateStart'] }, {
  description: 'Returns the start of the date range; a date is its own start.',
  examples: routineExamples,
  arguments: [[arg.dateRange('range')], [arg.date('date')]],
  handler: ({ subject }) => (subject instanceof FormulaDateRange ? new FormulaDate(subject.value.start) : subject),
});
