export interface CreateSessionOptions {
  dequeue: () => string | undefined;
  onStart: () => void;
  onComplete: () => void;
}

export interface QueueProcessingSession {
  /**
   * Async iterator for processing queue items.
   * Automatically manages scheduler lifecycle.
   */
  processItems: () => AsyncIterableIterator<string>;

  /**
   * Cleanup resources when processing is complete.
   * Used with 'using' declarations for automatic resource management.
   */
  [Symbol.dispose]: () => void;
}

/**
 * Manages queue processing lifecycle.
 * Integrates with existing RecalculationQueue and Scheduler.
 */
export class QueueProcessor {
  /**
   * Creates a processing session with automatic lifecycle management.
   * Supports ES2025 'using' declarations.
   */
  public static createSession(options: CreateSessionOptions): QueueProcessingSession {
    const { dequeue, onStart, onComplete } = options;
    let isDisposed = false;

    return {
      async* processItems(): AsyncIterableIterator<string> {
        if (isDisposed) {
          throw new Error('Session has been disposed');
        }

        onStart();

        try {
          let nodeId: string | undefined;
          // Process all items in the queue
          // eslint-disable-next-line no-cond-assign
          while ((nodeId = dequeue()) !== undefined) {
            if (isDisposed) {
              break;
            }

            yield nodeId;
          }
        }
        finally {
          onComplete();
        }
      },

      [Symbol.dispose](): void {
        if (!isDisposed) {
          isDisposed = true;
          onComplete();
        }
      },
    };
  }
}
