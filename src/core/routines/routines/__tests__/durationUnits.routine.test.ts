import { Temporal } from 'temporal-polyfill';

import { FormulaDuration, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const context = {
  d: new FormulaDuration(Temporal.Duration.from({ years: 2, months: 5, days: 10, hours: 12, minutes: 30, seconds: 15 })),
};

describe('years routine', new RoutineTester('years').examples([
  {
    formula: 'd.years()',
    context,
    expected: new FormulaNumber(2),
  },
  {
    formula: 'd.years(1)',
    context,
    expected: {
      method: {
        message: 'Expected no arguments.',
        location: [2, 7],
      },
    },
  },
  {
    formula: 'years(1)',
    expected: {
      function: {
        message: 'Expected type Duration.',
        location: [6, 7],
      },
    },
  },
]));

describe('months routine', new RoutineTester('months').examples([
  {
    formula: 'd.months()',
    context,
    expected: new FormulaNumber(5),
  },
]));

describe('days routine', new RoutineTester('days').examples([
  {
    formula: 'd.days()',
    context,
    expected: new FormulaNumber(10),
  },
]));

describe('hours routine', new RoutineTester('hours').examples([
  {
    formula: 'd.hours()',
    context,
    expected: new FormulaNumber(12),
  },
]));

describe('minutes routine', new RoutineTester('minutes').examples([
  {
    formula: 'd.minutes()',
    context,
    expected: new FormulaNumber(30),
  },
]));

describe('seconds routine', new RoutineTester('seconds').examples([
  {
    formula: 'd.seconds()',
    context,
    expected: new FormulaNumber(15),
  },
]));
