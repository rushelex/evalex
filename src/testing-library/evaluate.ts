import type { EvaluateOptions } from '../core';

import { Expression } from '../core';

export function evaluate(formula: string, options: EvaluateOptions = {}) {
  return new Expression(formula).evaluate(options).result;
}
