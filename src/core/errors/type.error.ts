import type { FormulaErrorContext, FormulaErrorOptions } from './base.error';

import { FormulaError } from './base.error';

export interface TypeFormulaErrorContext extends FormulaErrorContext {
  expected: (string | number) | (string | number)[];
  actual: (string | number) | (string | number)[];
}

export interface TypeFormulaErrorOptions<T extends FormulaErrorContext> extends FormulaErrorOptions<TypeFormulaErrorContext & T> {
}

export class TypeFormulaError<T extends FormulaErrorContext> extends FormulaError<TypeFormulaErrorContext & T> {
  constructor(message: string, options: TypeFormulaErrorOptions<T>) {
    super(message, options);
  }
}
