import { Temporal } from 'temporal-polyfill';

import { FormulaDate } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('fromTimestamp');

function utc(isoString: string): FormulaDate {
  return FormulaDate.from(Temporal.ZonedDateTime.from(`${isoString}+00:00[UTC]`));
}

describe('fromTimestamp routine', tester.examples([
  {
    formula: '1689024915123.fromTimestamp()',
    expected: utc('2023-07-10T21:35:00'),
  },
  {
    formula: '0.fromTimestamp()',
    expected: utc('1970-01-01T00:00:00'),
  },
  {
    formula: '(-1).fromTimestamp()',
    expected: utc('1969-12-31T23:59:00'),
  },
  {
    formula: '(60000.5).fromTimestamp()',
    expected: utc('1970-01-01T00:01:00'),
  },
  {
    formula: '9000000000000000.fromTimestamp()',
    expected: {
      function: {
        message: 'Expected timestamp between -8640000000000000 and 8640000000000000.',
        location: [14, 30],
      },
      method: {
        message: 'Expected timestamp between -8640000000000000 and 8640000000000000.',
        location: [17, 30],
      },
    },
  },
]));
