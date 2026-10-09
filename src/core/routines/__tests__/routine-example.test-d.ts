import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { Errors } from '../../errors';

describe('RoutineExampleOptions', () => {
  it('should accept either a result or an error', () => {
    expectTypeOf({ formula: () => 'pi()', result: () => new FormulaNumber(Math.PI) }).toMatchTypeOf<RoutineExampleOptions>();
    expectTypeOf({
      formula: () => 'pi(1)',
      error: { type: Errors.Argument.ExactCount, message: 'Expected no arguments.', location: { function: [3, 4] as const } },
    }).toMatchTypeOf<RoutineExampleOptions>();
  });

  it('should reject an example with both a result and an error', () => {
    const example = {
      formula: () => 'pi()',
      result: () => new FormulaNumber(Math.PI),
      error: { type: Errors.Argument.ExactCount, message: 'Expected no arguments.', location: {} },
    };

    expectTypeOf(example).not.toMatchTypeOf<RoutineExampleOptions>();
  });
});
