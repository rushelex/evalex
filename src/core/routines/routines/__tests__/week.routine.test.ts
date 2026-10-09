import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"week" method routine', new RoutineTester('week').examples({
  skipFunction: true,
}, [
  {
    formula: 'd.week()',
    context: {
      d: new FormulaDate(Temporal.ZonedDateTime.from({ timeZone: 'UTC', year: 2024, month: 7, day: 28 })),
    },
    expected: new FormulaNumber(30),
  },
]));
