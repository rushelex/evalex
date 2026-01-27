import type { FormulaErrorContext, FormulaErrorOptions } from './base.error';

import { FormulaError } from './base.error';

export interface ReferenceFormulaErrorContext extends FormulaErrorContext {
  name: string;
  type: 'variable' | 'function' | 'method';
  target?: string;
}

export class ReferenceFormulaError extends FormulaError<ReferenceFormulaErrorContext> {
  constructor(message: string, options: FormulaErrorOptions<ReferenceFormulaErrorContext>) {
    super(message, options);
  }
}
