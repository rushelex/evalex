import type { Class } from 'type-fest';

import type { FormulaDataType } from '../../data-types';
import type { RoutineExample } from '../routine-example';

import { evaluate } from '../../../testing-library';

/**
 * Asserts that a routine example evaluates to its result, or fails with its error in the given call form.
 *
 * @throws Error when an error example has no location for the form, so the form would go unchecked.
 */
export function checkRoutineExample(example: RoutineExample, form: 'function' | 'method'): void {
  if (example.error) {
    const { type, message, location } = example.error;
    const offsets = location[form];

    if (!offsets) {
      throw new Error(`The error of example "${example.formula}" has no location for the ${form} form.`);
    }

    const error = catchError(() => evaluate(example.formula));

    expect(type.is(error), `"${example.formula}" should fail with the example's error, got: ${String(error)}`).toBe(true);
    expect((error as Error).message).toBe(`${message} [${offsets[0]},${offsets[1]}]`);

    return;
  }

  const expected = example.result!();

  expect(evaluate(example.formula)).toBeFormulaDataType(expected.constructor as Class<FormulaDataType>, expected.value);
}

function catchError(fn: () => unknown): unknown {
  try {
    fn();
  }
  catch (error) {
    return error;
  }
}
