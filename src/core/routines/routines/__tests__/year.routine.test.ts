import { Temporal } from 'temporal-polyfill';

import { FormulaDate, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const context = {
  d: new FormulaDate(Temporal.ZonedDateTime.from({ timeZone: 'UTC', year: 2024, month: 7, day: 28 })),
};

describe('"year" method routine', new RoutineTester('year').examples({
  skipFunction: true,
}, [
  {
    formula: 'd.year()',
    context,
    expected: new FormulaNumber(2024),
  },
  {
    formula: 'd.year(1)',
    context,
    expected: {
      method: {
        message: 'Expected no arguments.',
        location: [2, 6],
      },
    },
  },
]));
