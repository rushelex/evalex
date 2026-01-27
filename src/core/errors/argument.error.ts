import type { TypeFormulaErrorContext, TypeFormulaErrorOptions } from './type.error';

import { TypeFormulaError } from './type.error';

export interface ArgumentFormulaErrorContext extends TypeFormulaErrorContext {
  argumentPosition?: number;
}

export class ArgumentFormulaError extends TypeFormulaError<ArgumentFormulaErrorContext> {
  constructor(message: string, options: TypeFormulaErrorOptions<ArgumentFormulaErrorContext>) {
    super(
      message,
      {
        location: options.location,
        context: {
          ...options.context,
        },
      },
    );
  }
}
