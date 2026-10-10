import { it } from '@fast-check/vitest';

import { evaluateOutcome } from '../../../../testing-library';
import { FormulaNumber } from '../../../data-types';
import { listConditionArbitrary } from '../../test-helpers/list-condition-arbitrary';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('findIndex');

describe('findIndex routine', () => {
  it.prop([listConditionArbitrary()])('should give the first index filter keeps, or -1', ({ context, condition }) => {
    const kept = `list.map(if(${condition}, index, -1)).filter(current >= 0)`;

    expect(evaluateOutcome(`findIndex(list, ${condition})`, { context }))
      .toHaveSameOutcomeAs(evaluateOutcome(`if(empty(${kept}), -1, first(${kept}))`, { context }));
  });

  describe('examples', tester.examples([
    {
      formula: '[null, null].findIndex(empty(current))',
      expected: new FormulaNumber(0),
    },
    {
      formula: '[1, "a"].findIndex(current > 0)',
      expected: new FormulaNumber(0),
    },
  ]));
});
