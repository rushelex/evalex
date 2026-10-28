import type { RoutineExampleOptions } from '../routine-example';

import { FormulaDate, FormulaDateRange, FormulaDateTime } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('dateRange(parseDate("2022-09-07"), parseDate("2023-09-07"))'),
    result: () => FormulaDate.from('2023-09-07'),
  },
  {
    formula: (name) => name('dateRange(parseDate("2022-09-07T10:00Z"), parseDate("2023-09-07T18:00Z"))'),
    result: () => FormulaDateTime.from('2023-09-07T18:00Z'),
  },
  {
    formula: (name) => name('parseDate("2023-08-30")'),
    result: () => FormulaDate.from('2023-08-30'),
  },
];

routinesRegistry.registerRoutine({ function: 'dateEnd', method: ['end', 'dateEnd'] }, {
  description: 'Returns the end of the date range; a date is its own end.',
  examples: routineExamples,
  arguments: [[arg.dateRange('range')], [arg.date('date')], [arg.dateTime('date')]],
  handler: ({ subject }) => (subject instanceof FormulaDateRange ? subject.end : subject),
});
