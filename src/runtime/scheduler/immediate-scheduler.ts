import type { Scheduler } from './scheduler';

export type ImmediateSchedulerState = 'idle' | 'processing';

/**
 * Scheduler that executes tasks immediately without any delay.
 * Perfect for synchronous executors and when immediate feedback is needed.
 *
 * Features:
 * - Immediate synchronous execution for sync tasks
 * - Proper promise tracking for async tasks
 *
 * @example
 * ```typescript
 * const scheduler = new ImmediateScheduler();
 * const runtime = new FormulaRuntime({
 *   scheduler,
 *   // ...
 * });
 * ```
 */
export class ImmediateScheduler implements Scheduler {
  #state: ImmediateSchedulerState = 'idle';
  #processingPromise: Promise<void> | null = null;

  scheduleIfIdle(task: () => void | Promise<void>): boolean {
    if (this.#state === 'processing') {
      return false;
    }

    // Execute immediately and track the promise
    this.#processingPromise = Promise.resolve(task()).then(
      () => this.#cleanup(),
      (error) => {
        this.#cleanup();
        throw error;
      },
    );

    return true;
  }

  markProcessingStarted(): void {
    this.#state = 'processing';
  }

  markProcessingComplete(): void {
    this.#state = 'idle';
    // Note: processingPromise is already resolved in the task completion
  }

  getProcessingPromise(): Promise<void> | null {
    return this.#processingPromise;
  }

  #cleanup(): void {
    this.#processingPromise = null;
  }
}
