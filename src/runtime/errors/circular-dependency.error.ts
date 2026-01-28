import type { FormulaErrorContext, FormulaErrorOptions } from '../../core';

import { FormulaError } from '../../core';

export interface CircularDependencyErrorContext extends FormulaErrorContext {
  nodeId: string;
  dependsOnId: string;
}

export class CircularDependencyError extends FormulaError<CircularDependencyErrorContext> {
  constructor(message: string, options: FormulaErrorOptions<CircularDependencyErrorContext>) {
    super(message, options);
  }
}
