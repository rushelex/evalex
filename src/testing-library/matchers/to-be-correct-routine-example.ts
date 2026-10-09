import type { FormulaDataType } from '~/core';
import type { RoutineExample } from '~/core/routines/routine-example';

import type { MatcherState } from './utils';

import { evaluate } from '../evaluate';

type RoutineForm = 'function' | 'method';

interface MatcherResult {
  readonly pass: boolean;
  readonly message: () => string;
  readonly actual?: unknown;
  readonly expected?: unknown;
}

/**
 * Custom matcher that asserts a routine example returns its result, or fails with its error, in a call form.
 *
 * @remarks
 * An error example must give a location for the checked form; without one the matcher fails, so a form never goes unchecked.
 *
 * @example
 * ```ts
 * expect(example).toBeCorrectRoutineExample('function');
 * ```
 */
export function toBeCorrectRoutineExample(received: RoutineExample, form: RoutineForm): MatcherResult {
  // @ts-expect-error - `this` is provided by expect.extend at runtime
  const context = this as MatcherState;

  return check(received, form, context);
}

function check(example: RoutineExample, form: RoutineForm, context: MatcherState): MatcherResult {
  const outcome = run(example.formula);

  if (example.error) {
    const { type, message, location } = example.error;
    const offsets = location[form];

    if (!offsets) {
      return { pass: false, message: () => `The error of example "${example.formula}" has no location for the ${form} form` };
    }

    const expectedMessage = `${message} [${offsets[0]},${offsets[1]}]`;

    if (!outcome.failed) {
      return {
        pass: false,
        message: () => `"${example.formula}" returned ${show(outcome.value)} instead of failing with "${expectedMessage}"`,
      };
    }

    const actualMessage = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);

    if (!type.is(outcome.error)) {
      return { pass: false, message: () => `"${example.formula}" failed with another error: "${actualMessage}"` };
    }

    return {
      pass: actualMessage === expectedMessage,
      message: () => `"${example.formula}" failed with "${actualMessage}" instead of "${expectedMessage}"`,
      actual: actualMessage,
      expected: expectedMessage,
    };
  }

  const expected = example.result!();

  if (outcome.failed) {
    return {
      pass: false,
      message: () => `"${example.formula}" failed with "${outcome.error instanceof Error ? outcome.error.message : String(outcome.error)}" instead of returning ${show(expected)}`,
    };
  }

  return {
    pass: outcome.value instanceof expected.constructor && context.equals(outcome.value.value, expected.value),
    message: () => `"${example.formula}" returned ${show(outcome.value)} instead of ${show(expected)}`,
    actual: outcome.value.value,
    expected: expected.value,
  };
}

function run(formula: string) {
  try {
    return { failed: false, value: evaluate(formula) } as const;
  }
  catch (error) {
    return { failed: true, error } as const;
  }
}

function show(value: FormulaDataType): string {
  return `${value.constructor.name}(${value.toString()})`;
}
