import { Temporal } from 'temporal-polyfill';

import { FormulaDuration, FormulaNumber } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const context = {
  d: new FormulaDuration(Temporal.Duration.from({ years: 2, months: 5, days: 10, hours: 12, minutes: 30, seconds: 15 })),
};

describe('"years" method routine', new RoutineTester('years').examples({
  skipFunction: true,
}, [
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
]));

describe('"months" method routine', new RoutineTester('months').examples({
  skipFunction: true,
}, [
  {
    formula: 'd.months()',
    context,
    expected: new FormulaNumber(5),
  },
]));

describe('"days" method routine', new RoutineTester('days').examples({
  skipFunction: true,
}, [
  {
    formula: 'd.days()',
    context,
    expected: new FormulaNumber(10),
  },
]));

describe('"hours" method routine', new RoutineTester('hours').examples({
  skipFunction: true,
}, [
  {
    formula: 'd.hours()',
    context,
    expected: new FormulaNumber(12),
  },
]));

describe('"minutes" method routine', new RoutineTester('minutes').examples({
  skipFunction: true,
}, [
  {
    formula: 'd.minutes()',
    context,
    expected: new FormulaNumber(30),
  },
]));

describe('"seconds" method routine', new RoutineTester('seconds').examples({
  skipFunction: true,
}, [
  {
    formula: 'd.seconds()',
    context,
    expected: new FormulaNumber(15),
  },
]));
