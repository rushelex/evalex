import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"date" method routine', new RoutineTester('date').examples({
  skipFunction: true,
}, [
  {
    formula: 'd.date()',
    context: {
      d: new FormulaDate(Temporal.ZonedDateTime.from({ timeZone: 'UTC', year: 2024, month: 7, day: 28 })),
    },
    expected: new FormulaNumber(28),
  },
]));
