import type { FormulaErrorContext, FormulaErrorOptions } from '../../core';

import { FormulaError } from '../../core';

export interface MaxDependenciesExceededErrorContext extends FormulaErrorContext {
  nodeId: string;
  count: number;
}

export class MaxDependenciesExceededError extends FormulaError<MaxDependenciesExceededErrorContext> {
  constructor(message: string, options: FormulaErrorOptions<MaxDependenciesExceededErrorContext>) {
    super(message, options);
  }
}
