import type { FormulaErrorContext, FormulaErrorOptions } from './base.error';

import { FormulaError } from './base.error';

export interface EvaluateFormulaErrorContext extends FormulaErrorContext {
  name: string;
  type: 'method' | 'function';
  target: string;
}

export class EvaluateFormulaError extends FormulaError<EvaluateFormulaErrorContext> {
  constructor(message: string, options: FormulaErrorOptions<EvaluateFormulaErrorContext>) {
    super(message, options);
  }
}
