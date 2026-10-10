import type { FormulaExecRequest, FormulaExecResult } from './types';

import { Executor } from './executor';

/**
 * Synchronous executor for formula evaluation.
 * Executes formulas immediately in the same thread.
 * Useful for SSR, tests, or small datasets.
 */
export class SyncExecutor extends Executor {
  exec(request: FormulaExecRequest): FormulaExecResult {
    return request.expression.evaluate({
      context: request.context,
    });
  }

  async terminate(): Promise<void> {
    // Do nothing
  }
}
