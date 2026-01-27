import type { FormulaErrorContext, FormulaErrorOptions } from './base.error';

import { FormulaError } from './base.error';

export interface RangeFormulaErrorContext extends FormulaErrorContext {
  actual: (string | number) | (string | number)[];
  expected: (string | number) | (string | number)[];
}

export class RangeFormulaError extends FormulaError<RangeFormulaErrorContext> {
  constructor(
    message: string,
    options: FormulaErrorOptions<RangeFormulaErrorContext>,
  ) {
    super(message, options);
  }
}
