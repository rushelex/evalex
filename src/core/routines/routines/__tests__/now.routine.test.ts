import { FormulaDate } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('now');

vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(Temporal.ZonedDateTime.from({
  year: 2024,
  month: 1,
  day: 31,
  hour: 12,
  minute: 30,
  second: 45,
  timeZone: 'UTC',
}));

describe('now routine', tester.examples([
  {
    formula: 'now()',
    expected: FormulaDate.from('2024-01-31T12:30:45+00:00[UTC]'),
  },
  {
    formula: 'now(1)',
    expected: {
      function: {
        message: 'Expected no arguments.',
        location: [0, 6],
      },
    },
  },
]));
