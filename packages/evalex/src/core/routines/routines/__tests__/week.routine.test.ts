import { FormulaDateTime, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('week routine', new RoutineTester('week').examples([
  {
    formula: 'd.week()',
    context: {
      d: new FormulaDateTime(Temporal.ZonedDateTime.from({ timeZone: 'UTC', year: 2024, month: 7, day: 28 })),
    },
    expected: new FormulaNumber(30),
  },
]));
