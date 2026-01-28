import type { FormulaErrorContext, FormulaErrorOptions } from '../../core';

import { FormulaError } from '../../core';

export interface MaxFormulaDepthErrorExceededContext extends FormulaErrorContext {
  nodeId: string;
  depth: number;
}

export class MaxFormulaDepthExceededError extends FormulaError<MaxFormulaDepthErrorExceededContext> {
  constructor(message: string, options: FormulaErrorOptions<MaxFormulaDepthErrorExceededContext>) {
    super(message, options);
  }
}
