import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('month routine', new RoutineTester('month').examples([
  {
    formula: 'd.month()',
    context: {
      d: new FormulaDate(Temporal.ZonedDateTime.from({ timeZone: 'UTC', year: 2024, month: 7, day: 28 })),
    },
    expected: new FormulaNumber(7),
  },
]));
