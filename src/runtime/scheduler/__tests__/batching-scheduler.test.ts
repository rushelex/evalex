import { BatchingScheduler } from '../batching-scheduler';

describe('BatchingScheduler', () => {
  let scheduler: BatchingScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Batching', () => {
    beforeEach(() => {
      scheduler = new BatchingScheduler({
        delayMs: 10,
      });
    });

    it('should delay task execution by delayMs', () => {
      const task = vi.fn();

      const scheduled = scheduler.scheduleIfIdle(task, { queueSize: 1 });

      expect(scheduled).toBe(true);
      expect(task).not.toHaveBeenCalled();

      // Advance time but not enough
      vi.advanceTimersByTime(5);
      expect(task).not.toHaveBeenCalled();

      // Advance to delayMs
      vi.advanceTimersByTime(5);
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('should not reset timer for subsequent enqueues', () => {
      const task1 = vi.fn();
      const task2 = vi.fn();

      // First enqueue starts the timer
      scheduler.scheduleIfIdle(task1, { queueSize: 1 });

      // Advance time a bit
      vi.advanceTimersByTime(5);

      // Second enqueue should not reset the timer
      scheduler.scheduleIfIdle(task2, { queueSize: 2 });

      expect(task1).not.toHaveBeenCalled();
      expect(task2).not.toHaveBeenCalled();

      // Advance to original delayMs (5 more ms)
      vi.advanceTimersByTime(5);

      // Only the last scheduled task should execute
      expect(task1).not.toHaveBeenCalled();
      expect(task2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Processing State Management', () => {
    beforeEach(() => {
      scheduler = new BatchingScheduler({
        delayMs: 10,
      });
    });

    it('should respect processing state', () => {
      const task1 = vi.fn();
      const task2 = vi.fn();

      // Schedule first task
      scheduler.scheduleIfIdle(task1, { queueSize: 1 });
      vi.advanceTimersByTime(10);
      expect(task1).toHaveBeenCalledTimes(1);

      // Mark processing started
      scheduler.markProcessingStarted();

      // Try to schedule during processing - should fail
      const scheduled = scheduler.scheduleIfIdle(task2, { queueSize: 1 });
      expect(scheduled).toBe(false);

      // Mark processing complete
      scheduler.markProcessingComplete();

      // Now schedule again - should start a new batch
      scheduler.scheduleIfIdle(task2, { queueSize: 1 });
      expect(task2).not.toHaveBeenCalled();

      // Should wait full delayMs again
      vi.advanceTimersByTime(10);
      expect(task2).toHaveBeenCalledTimes(1);
    });

    it('should handle continuous updates during processing', () => {
      const processingTask = vi.fn();
      const newTask = vi.fn();

      // Schedule and execute first task
      scheduler.scheduleIfIdle(processingTask, { queueSize: 1 });
      vi.advanceTimersByTime(10);
      expect(processingTask).toHaveBeenCalledTimes(1);

      // Simulate processing
      scheduler.markProcessingStarted();

      // Items added during processing
      const scheduled1 = scheduler.scheduleIfIdle(newTask, { queueSize: 1 });
      const scheduled2 = scheduler.scheduleIfIdle(newTask, { queueSize: 2 });

      expect(scheduled1).toBe(false);
      expect(scheduled2).toBe(false);
      expect(newTask).not.toHaveBeenCalled();

      // Complete processing
      scheduler.markProcessingComplete();

      // Schedule for the items that were added during processing
      const scheduled3 = scheduler.scheduleIfIdle(newTask, { queueSize: 2 });
      expect(scheduled3).toBe(true);

      // Should batch these new items
      vi.advanceTimersByTime(10);
      expect(newTask).toHaveBeenCalledTimes(1);
    });
  });

  describe('Canceling', () => {
    beforeEach(() => {
      scheduler = new BatchingScheduler({
        delayMs: 10,
      });
    });

    it('should cancel pending tasks', () => {
      const task = vi.fn();

      scheduler.scheduleIfIdle(task, { queueSize: 1 });
      expect(task).not.toHaveBeenCalled();

      scheduler.cancel();

      vi.advanceTimersByTime(20);
      expect(task).not.toHaveBeenCalled();
    });

    it('should reset state on cancel', () => {
      const task1 = vi.fn();
      const task2 = vi.fn();

      // Schedule task
      scheduler.scheduleIfIdle(task1, { queueSize: 1 });

      // Cancel
      scheduler.cancel();

      // Schedule new task - should start fresh batch
      scheduler.scheduleIfIdle(task2, { queueSize: 1 });

      vi.advanceTimersByTime(10);
      expect(task1).not.toHaveBeenCalled();
      expect(task2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero delays', () => {
      scheduler = new BatchingScheduler({
        delayMs: 0,
      });

      const task = vi.fn();
      scheduler.scheduleIfIdle(task, { queueSize: 1 });

      // Should execute immediately with zero delays
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('should handle tasks without queue context', () => {
      scheduler = new BatchingScheduler({
        delayMs: 10,
      });

      const task = vi.fn();

      // Schedule without context
      scheduler.scheduleIfIdle(task);

      // Should execute immediately (no firstEnqueueTime set)
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('should handle empty queue size in context', () => {
      scheduler = new BatchingScheduler({
        delayMs: 10,
      });

      const task = vi.fn();

      // Schedule with zero queue size
      scheduler.scheduleIfIdle(task, { queueSize: 0 });

      // Should execute immediately
      expect(task).toHaveBeenCalledTimes(1);
    });
  });

  describe('Processing Promise Tracking', () => {
    beforeEach(() => {
      scheduler = new BatchingScheduler({
        delayMs: 10,
      });
    });

    it('should return null when no processing scheduled', () => {
      expect(scheduler.getProcessingPromise()).toBe(null);
    });

    it('should return promise immediately when task is scheduled', () => {
      const task = vi.fn();

      scheduler.scheduleIfIdle(task, { queueSize: 1 });

      // Promise should be created immediately, not after delay
      const promise = scheduler.getProcessingPromise();
      expect(promise).toBeInstanceOf(Promise);

      // Task should not be called yet
      expect(task).not.toHaveBeenCalled();

      // Advance time to trigger execution
      vi.advanceTimersByTime(10);

      // Now task should be called
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('should track promise through batch delay', async () => {
      const task = vi.fn();

      scheduler.scheduleIfIdle(task, { queueSize: 1 });

      // Promise should be created immediately
      const promise = scheduler.getProcessingPromise();
      expect(promise).toBeInstanceOf(Promise);
      expect(task).not.toHaveBeenCalled();

      // Advance to batch delay
      vi.advanceTimersByTime(10);

      // Task should be called
      expect(task).toHaveBeenCalledTimes(1);

      // Same promise should still be tracked
      expect(scheduler.getProcessingPromise()).toBe(promise);

      // After markProcessingComplete is called, promise should be cleared
      scheduler.markProcessingComplete();
      expect(scheduler.getProcessingPromise()).toBe(null);
    });

    it('should clear promise on cancel', () => {
      const task = vi.fn();

      scheduler.scheduleIfIdle(task, { queueSize: 1 });

      // Promise should be created immediately
      expect(scheduler.getProcessingPromise()).toBeInstanceOf(Promise);

      scheduler.cancel();

      expect(scheduler.getProcessingPromise()).toBe(null);
      expect(task).not.toHaveBeenCalled();
    });

    it('should track promise for immediate execution', async () => {
      const task = vi.fn();

      // Execute immediately (no context)
      scheduler.scheduleIfIdle(task);

      const promise = scheduler.getProcessingPromise();
      expect(promise).toBeInstanceOf(Promise);
      expect(task).toHaveBeenCalledTimes(1);

      // Mark processing complete to resolve the promise
      scheduler.markProcessingComplete();

      // Promise should resolve
      await promise;

      // Promise should be cleared after markProcessingComplete
      expect(scheduler.getProcessingPromise()).toBe(null);
    });

    it('should resolve promise when markProcessingComplete is called', async () => {
      const task = vi.fn();

      scheduler.scheduleIfIdle(task, { queueSize: 1 });

      // Get promise immediately
      const promise = scheduler.getProcessingPromise();
      expect(promise).toBeInstanceOf(Promise);

      // Advance time to execute task
      vi.advanceTimersByTime(10);
      expect(task).toHaveBeenCalledTimes(1);

      // Manually mark processing complete
      scheduler.markProcessingComplete();

      // Promise should resolve
      await expect(promise).resolves.toBeUndefined();

      // And should be cleared
      expect(scheduler.getProcessingPromise()).toBe(null);
    });

    it('should allow waiting for processing before task executes', async () => {
      const task = vi.fn().mockResolvedValue(undefined);

      scheduler.scheduleIfIdle(task, { queueSize: 1 });

      // Get promise immediately
      const promise = scheduler.getProcessingPromise();
      expect(promise).toBeInstanceOf(Promise);

      // Task not called yet
      expect(task).not.toHaveBeenCalled();

      // Wait for processing in a separate async flow
      const waitPromise = promise!.then(() => {
        // At this point, task should have been called
        expect(task).toHaveBeenCalledTimes(1);
      });

      // Advance time to trigger execution
      vi.advanceTimersByTime(10);

      // Mark processing complete to resolve the promise
      scheduler.markProcessingComplete();

      // Wait for the promise to resolve
      await waitPromise;
    });
  });
});
