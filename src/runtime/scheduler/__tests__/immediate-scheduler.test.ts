import { ImmediateScheduler } from '../immediate-scheduler';

describe('ImmediateScheduler', () => {
  let scheduler: ImmediateScheduler;

  beforeEach(() => {
    scheduler = new ImmediateScheduler();
  });

  it('should execute task immediately', () => {
    const task = vi.fn();

    const scheduled = scheduler.scheduleIfIdle(task);

    expect(scheduled).toBe(true);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('should not execute when already processing', () => {
    const task1 = vi.fn();
    const task2 = vi.fn();

    scheduler.markProcessingStarted();

    const scheduled1 = scheduler.scheduleIfIdle(task1);
    const scheduled2 = scheduler.scheduleIfIdle(task2);

    expect(scheduled1).toBe(false);
    expect(scheduled2).toBe(false);
    expect(task1).not.toHaveBeenCalled();
    expect(task2).not.toHaveBeenCalled();
  });

  it('should can schedule again after marking complete', () => {
    const task1 = vi.fn();
    const task2 = vi.fn();

    // First task
    scheduler.scheduleIfIdle(task1);
    expect(task1).toHaveBeenCalledTimes(1);

    // Mark as processing
    scheduler.markProcessingStarted();

    // Try to schedule during processing - should fail
    const scheduled = scheduler.scheduleIfIdle(task2);
    expect(scheduled).toBe(false);
    expect(task2).not.toHaveBeenCalled();

    // Mark as complete
    scheduler.markProcessingComplete();

    // Now can schedule again
    const scheduled2 = scheduler.scheduleIfIdle(task2);
    expect(scheduled2).toBe(true);
    expect(task2).toHaveBeenCalledTimes(1);
  });

  it('should handle async tasks', async () => {
    let resolved = false;
    const task = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      resolved = true;
    });

    scheduler.scheduleIfIdle(task);

    expect(task).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(false);

    // Wait for async task to complete
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(resolved).toBe(true);
  });

  it('should ignore context parameter', () => {
    const task = vi.fn();

    // @ts-expect-error context is not used
    const scheduled = scheduler.scheduleIfIdle(task, { queueSize: 5 });

    expect(scheduled).toBe(true);
    expect(task).toHaveBeenCalledTimes(1);
  });

  describe('Processing Promise Tracking', () => {
    it('should return null when no processing', () => {
      expect(scheduler.getProcessingPromise()).toBe(null);
    });

    it('should return promise during sync task execution', () => {
      const task = vi.fn();

      scheduler.scheduleIfIdle(task);

      const promise = scheduler.getProcessingPromise();
      expect(promise).toBeInstanceOf(Promise);
    });

    it('should clear promise after sync task completes', async () => {
      const task = vi.fn();

      scheduler.scheduleIfIdle(task);
      const promise = scheduler.getProcessingPromise();

      expect(promise).toBeInstanceOf(Promise);

      // Wait for promise to resolve
      await promise;

      expect(scheduler.getProcessingPromise()).toBe(null);
    });

    it('should track async task promise correctly', async () => {
      let resolveTask: () => void;
      const taskPromise = new Promise<void>((resolve) => {
        resolveTask = resolve;
      });

      const task = vi.fn(async () => taskPromise);

      scheduler.scheduleIfIdle(task);

      const promise = scheduler.getProcessingPromise();
      expect(promise).toBeInstanceOf(Promise);

      // Promise should still be tracked
      expect(scheduler.getProcessingPromise()).toBe(promise);

      // Resolve the task
      resolveTask!();
      await promise;

      // Now should be cleared
      expect(scheduler.getProcessingPromise()).toBe(null);
    });
  });
});
