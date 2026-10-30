import { FormulaDateTime, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('date routine', new RoutineTester('date').examples([
  {
    formula: 'd.date()',
    context: {
      d: new FormulaDateTime(Temporal.ZonedDateTime.from({ timeZone: 'UTC', year: 2024, month: 7, day: 28 })),
    },
    expected: new FormulaNumber(28),
  },
]));
