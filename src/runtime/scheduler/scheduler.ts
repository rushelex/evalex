/**
 * Strategy for scheduling task execution.
 * Decouples "when to execute" logic from "how to execute" logic.
 */
export interface Scheduler {
  /**
   * Schedules a task for execution if not already processing.
   *
   * @param task - The task to execute
   * @param context - Additional context for scheduling decisions
   * @param context.queueSize - Number of tasks waiting in the queue
   * @returns true if the task was scheduled, false if already processing
   */
  scheduleIfIdle: (
    task: () => void | Promise<void>,
    context?: { queueSize: number },
  ) => boolean;

  /**
   * Marks the start of task execution.
   * Should be called before starting to process the queue.
   */
  markProcessingStarted: () => void;

  /**
   * Marks the end of task execution.
   * Should be called after processing is complete.
   */
  markProcessingComplete: () => void;

  /**
   * Returns a promise that resolves when the current processing is complete.
   * Returns null if no processing is happening.
   */
  getProcessingPromise: () => Promise<void> | null;

  /**
   * Cancels any pending scheduled tasks.
   * Useful for cleanup.
   */
  cancel?: () => void;
}
