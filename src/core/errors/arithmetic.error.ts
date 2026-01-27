import type { FormulaErrorContext, FormulaErrorOptions } from './base.error';

import { FormulaError } from './base.error';

export interface ArithmeticFormulaErrorContext extends FormulaErrorContext {
  operation: 'division' | 'modulo';
  dividend: number;
}

export class ArithmeticFormulaError extends FormulaError<ArithmeticFormulaErrorContext> {
  constructor(message: string, options: FormulaErrorOptions<ArithmeticFormulaErrorContext>) {
    super(message, options);
  }
}
