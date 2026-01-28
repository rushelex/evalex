import { Temporal } from 'temporal-polyfill';

import { FormulaDate } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-test-runner';

const tester = new RoutineTester('today');

vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(Temporal.ZonedDateTime.from({
  year: 2024,
  month: 1,
  day: 31,
  timeZone: 'UTC',
}));

describe('today routine', tester.onlyTestSuites([
  {
    formula: 'today()',
    expected: FormulaDate.from('2024-01-31T00:00:00+00:00[UTC]'),
  },
  {
    formula: 'today(1)',
    expected: {
      function: {
        message: 'Expected 0 argument(s).',
        location: [0, 8],
      },
    },
  },
]));
