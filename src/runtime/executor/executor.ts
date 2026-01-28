import type { FormulaExecRequest, FormulaExecResult } from './types';

/**
 * Base abstract class for all executors.
 * Defines the contract for formula execution.
 */
export abstract class Executor {
  /**
   * Executes a formula with given context.
   * @param request - The formula execution request
   * @returns The execution result (sync or async)
   */
  abstract exec(request: FormulaExecRequest): FormulaExecResult | Promise<FormulaExecResult>;

  /**
   * Optional cleanup method for executors that need it.
   * @returns Promise that resolves when cleanup is complete
   */
  abstract terminate(): Promise<void>;
}
