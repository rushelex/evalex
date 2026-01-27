import { Temporal } from 'temporal-polyfill';

import { FormulaDate } from '../../../data-types';
import { RoutineTestRunner } from '../../test-helpers/routine-test-runner';

const runner = new RoutineTestRunner('now');

vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(Temporal.ZonedDateTime.from({
  year: 2024,
  month: 1,
  day: 31,
  hour: 12,
  minute: 30,
  second: 45,
  timeZone: 'UTC',
}));

describe('now routine', runner.onlyTestSuites([
  {
    formula: 'now()',
    expected: FormulaDate.from('2024-01-31T12:30:45+00:00[UTC]'),
  },
  {
    formula: 'now(1)',
    expected: {
      function: {
        message: 'Expected 0 argument(s).',
        location: [0, 6],
      },
    },
  },
]));
