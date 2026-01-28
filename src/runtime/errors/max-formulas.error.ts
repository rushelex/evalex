import type { FormulaErrorContext, FormulaErrorOptions } from '../../core';

import { FormulaError } from '../../core';

export interface MaxFormulasExceededErrorContext extends FormulaErrorContext {
  nodeId: string;
  count: number;
}

export class MaxFormulasExceededError extends FormulaError<MaxFormulasExceededErrorContext> {
  constructor(message: string, options: FormulaErrorOptions<MaxFormulasExceededErrorContext>) {
    super(message, options);
  }
}
