import type { Scheduler } from './scheduler';

export type BatchingSchedulerState = 'idle' | 'scheduled' | 'processing';

/**
 * Options for batching scheduler.
 */
export interface BatchingSchedulerOptions {
  /**
   * Delay in milliseconds before starting batch processing.
   * This allows collecting multiple updates before processing.
   */
  delayMs: number;
}

/**
 * Scheduler that batches task execution to improve performance.
 * Collects multiple updates within a time window and processes them together,
 * reducing unnecessary recalculations and improving overall efficiency.
 *
 * Features:
 * - Configurable delay for collecting updates before processing
 * - Automatic deduplication - only the latest task is executed
 * - Compatible with both sync and async executors
 *
 * @example
 * ```typescript
 * const scheduler = new BatchingScheduler({
 *   delayMs: 10 // Wait 10ms before processing
 * });
 *
 * const runtime = new FormulaRuntime({
 *   scheduler,
 *   // ...
 * });
 * ```
 */
export class BatchingScheduler implements Scheduler {
  #state: BatchingSchedulerState = 'idle';
  #abortController: AbortController | null = null;
  #processingDeferred: PromiseWithResolvers<void> | null = null;
  #latestTask: (() => void | Promise<void>) | null = null;
  readonly #options: BatchingSchedulerOptions;

  constructor(
    options: BatchingSchedulerOptions,
  ) {
    this.#options = options;
  }

  scheduleIfIdle(
    task: () => void | Promise<void>,
    context?: { queueSize: number },
  ): boolean {
    if (this.#state === 'processing') {
      return false;
    }

    // Store the latest task
    this.#latestTask = task;

    // Ensure we have a processing promise
    this.#ensureProcessingPromise();

    // Check for immediate execution
    if (this.#shouldExecuteImmediately(context)) {
      this.#executeImmediately();
      return true;
    }

    // Schedule delayed execution
    this.#scheduleDelayedExecution();
    return true;
  }

  markProcessingStarted(): void {
    this.#state = 'processing';
  }

  markProcessingComplete(): void {
    this.#state = 'idle';
    this.#completeProcessing();
  }

  getProcessingPromise(): Promise<void> | null {
    return this.#processingDeferred?.promise ?? null;
  }

  cancel(): void {
    this.#abortController?.abort('Scheduler cancelled');
    this.#cleanup();
  }

  #shouldExecuteImmediately(context?: { queueSize: number }): boolean {
    return !context || context.queueSize === 0 || this.#options.delayMs === 0;
  }

  #ensureProcessingPromise(): void {
    this.#processingDeferred ??= Promise.withResolvers<void>();
  }

  #executeImmediately(): void {
    // Cancel any pending delayed execution
    this.#abortController?.abort();
    this.#abortController = null;

    void this.#executeTask();
  }

  #scheduleDelayedExecution(): void {
    // Only schedule if not already scheduled
    if (this.#state === 'scheduled') {
      return;
    }

    this.#state = 'scheduled';

    // Cancel any existing schedule
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    // Use setTimeout for compatibility with test infrastructure
    const timeoutId = setTimeout(() => {
      if (!this.#abortController?.signal.aborted) {
        void this.#executeTask();
      }
    }, this.#options.delayMs);

    // Clean up timeout on abort
    this.#abortController.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
    }, { once: true });
  }

  async #executeTask(): Promise<void> {
    const task = this.#latestTask;
    if (!task)
      return;

    // Clear state for next scheduling
    this.#latestTask = null;
    this.#abortController = null;
    this.#state = 'scheduled'; // Prevent new scheduling during execution

    await task();
  }

  #completeProcessing(): void {
    this.#processingDeferred?.resolve();
    this.#cleanup();
  }

  #cleanup(): void {
    this.#state = 'idle';
    this.#latestTask = null;
    this.#abortController = null;

    // Resolve and clear the deferred
    this.#processingDeferred?.resolve();
    this.#processingDeferred = null;
  }
}
