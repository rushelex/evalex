import type { FormulaExecRequest, FormulaExecResult } from './types';

import { Executor } from './executor';

export type AsyncRunner = (job: () => FormulaExecResult, signal?: AbortSignal) => Promise<FormulaExecResult>;

export interface AsyncExecutorOptions {
  runner?: AsyncRunner;
  abortController?: AbortController;
  onTerminate?: () => Promise<void>;
  timeoutMs?: number;
}

/**
 * Asynchronous executor for formula evaluation.
 * Offloads formula execution to avoid blocking the main thread.
 * Can use Web Workers, thread pools, or microtasks.
 * Supports timeout and external abort control.
 */
export class AsyncExecutor extends Executor {
  readonly #runner: AsyncRunner;
  readonly #abortController?: AbortController;
  readonly #onTerminate?: () => Promise<void>;
  readonly #timeoutMs?: number;

  constructor(options: AsyncExecutorOptions = {}) {
    super();
    this.#runner = options.runner ?? this.#defaultRunner;
    this.#abortController = options.abortController;
    this.#onTerminate = options.onTerminate;
    this.#timeoutMs = options.timeoutMs;
  }

  async exec(request: FormulaExecRequest): Promise<FormulaExecResult> {
    const job = () => request.expression.evaluate({
      context: request.context,
    });

    // Combine signals if needed
    const signals: AbortSignal[] = [];
    if (this.#abortController?.signal) {
      signals.push(this.#abortController.signal);
    }
    if (this.#timeoutMs) {
      signals.push(AbortSignal.timeout(this.#timeoutMs));
    }

    const signal = signals.length > 0 ? AbortSignal.any(signals) : undefined;

    try {
      return await this.#runner(job, signal);
    }
    catch (error) {
      // Replace generic timeout error with our custom message
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(`Formula execution timed out after ${this.#timeoutMs}ms`);
      }
      throw error;
    }
  }

  async terminate(): Promise<void> {
    this.#abortController?.abort(new Error('Aborted'));
    await this.#onTerminate?.();
  }

  #defaultRunner: AsyncRunner = async (job, signal) => {
    return new Promise((resolve, reject) => {
      queueMicrotask(() => {
        if (signal?.aborted) {
          reject(signal.reason || new Error('Aborted'));
        }
        else {
          try {
            resolve(job());
          }
          catch (error) {
            reject(error);
          }
        }
      });
    });
  };
}
