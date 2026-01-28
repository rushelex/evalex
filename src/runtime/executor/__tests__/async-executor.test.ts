import type { AsyncRunner } from '../async-executor';
import type { FormulaExecRequest } from '../types';

import { Expression, FormulaNumber } from '../../../core';
import { AsyncExecutor } from '../async-executor';

describe(AsyncExecutor, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Execution', () => {
    it('should execute formula asynchronously', async () => {
      // Arrange
      const executor = new AsyncExecutor();
      const request: FormulaExecRequest = {
        expression: new Expression('1 + 2'),
        context: {},
      };

      // Act
      const resultPromise = executor.exec(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.result).toBeInstanceOf(FormulaNumber);
      if (result.result instanceof FormulaNumber) {
        expect(result.result.value).toBe(3);
      }
      expect(result.dependencies).toEqual([]);
    });

    it('should extract dependencies', async () => {
      // Arrange
      const executor = new AsyncExecutor();
      const request: FormulaExecRequest = {
        expression: new Expression('a + b'),
        context: {
          a: new FormulaNumber(5),
          b: new FormulaNumber(10),
        },
      };

      // Act
      const resultPromise = executor.exec(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.result).toBeInstanceOf(FormulaNumber);
      if (result.result instanceof FormulaNumber) {
        expect(result.result.value).toBe(15);
      }
      expect(result.dependencies).toEqual(['a', 'b']);
    });

    it('should use custom runner', async () => {
      // Arrange
      const customRunner = vi.fn<AsyncRunner>().mockResolvedValue({
        result: new FormulaNumber(42),
        dependencies: ['custom'],
      });
      const executor = new AsyncExecutor({ runner: customRunner });
      const request: FormulaExecRequest = {
        expression: new Expression('test'),
        context: {},
      };

      // Act
      const result = await executor.exec(request);

      // Assert
      expect(customRunner).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
      );
      expect(result.result).toEqual(new FormulaNumber(42));
      expect(result.dependencies).toEqual(['custom']);
    });
  });

  describe('Timeout Functionality', () => {
    it('should timeout after specified duration', async () => {
      // Arrange - use slow runner to ensure timeout
      const slowRunner = vi.fn<AsyncRunner>().mockImplementation(async (job, signal) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => resolve(job()), 200);

          signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(signal.reason);
          });
        });
      });

      const executor = new AsyncExecutor({
        runner: slowRunner,
        timeoutMs: 100,
      });

      const request: FormulaExecRequest = {
        expression: new Expression('1 + 1'),
        context: {},
      };

      // Act
      // Add .catch() immediately to prevent unhandled rejection
      const promise = executor.exec(request).catch((e) => e);

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(150);

      // Assert
      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Formula execution timed out after 100ms');
    });

    it('should complete successfully if faster than timeout', async () => {
      // Arrange
      const executor = new AsyncExecutor({ timeoutMs: 100 });
      const request: FormulaExecRequest = {
        expression: new Expression('42'),
        context: {},
      };

      // Act
      const promise = executor.exec(request);
      // Complete before timeout
      await vi.runAllTimersAsync();
      const result = await promise;

      // Assert
      expect(result.result).toBeInstanceOf(FormulaNumber);
      if (result.result instanceof FormulaNumber) {
        expect(result.result.value).toBe(42);
      }
    });

    it('should work without timeout', async () => {
      // Arrange
      const executor = new AsyncExecutor(); // No timeout
      const request: FormulaExecRequest = {
        expression: new Expression('99'),
        context: {},
      };

      // Act
      const promise = executor.exec(request);
      await vi.runAllTimersAsync();
      const result = await promise;

      // Assert
      expect(result.result).toBeInstanceOf(FormulaNumber);
      if (result.result instanceof FormulaNumber) {
        expect(result.result.value).toBe(99);
      }
    });
  });

  describe('Abort Functionality', () => {
    it('should abort execution when controller aborts', async () => {
      // Arrange
      const controller = new AbortController();
      const slowRunner = vi.fn<AsyncRunner>().mockImplementation(async (job, signal) => {
        // Wait a bit then check signal
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (signal?.aborted)
          throw signal.reason;
        return job();
      });

      const executor = new AsyncExecutor({
        runner: slowRunner,
        abortController: controller,
      });

      // Act
      // Add .catch() immediately to prevent unhandled rejection
      const promise = executor.exec({
        expression: new Expression('1 + 1'),
        context: {},
      }).catch((e) => e);

      // Abort before runner completes
      await vi.advanceTimersByTimeAsync(10);
      controller.abort(new Error('User cancelled'));
      await vi.runAllTimersAsync();

      // Assert
      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('User cancelled');
    });

    it('should abort via terminate method', async () => {
      // Arrange
      const controller = new AbortController();
      const executor = new AsyncExecutor({ abortController: controller });

      // Add .catch() immediately to prevent unhandled rejection
      const promise = executor.exec({
        expression: new Expression('1 + 1'),
        context: {},
      }).catch((e) => e);

      // Act - terminate immediately
      await executor.terminate();
      await vi.runAllTimersAsync();

      // Assert
      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Aborted');
    });

    it('should call onTerminate handler', async () => {
      // Arrange
      const onTerminate = vi.fn().mockResolvedValue(undefined);
      const executor = new AsyncExecutor({ onTerminate });

      // Act
      await executor.terminate();

      // Assert
      expect(onTerminate).toHaveBeenCalled();
    });
  });

  describe('Real-World Usage Examples', () => {
    it('example: simple async work', async () => {
      // This is how most users would use AsyncExecutor
      const executor = new AsyncExecutor({ timeoutMs: 1000 });

      const result = await executor.exec({
        expression: new Expression('10 * 5'),
        context: {},
      });

      expect(result.result).toBeInstanceOf(FormulaNumber);
      if (result.result instanceof FormulaNumber) {
        expect(result.result.value).toBe(50);
      }
    });

    it('example: with external abort control', async () => {
      // User wants to cancel formulas manually
      const controller = new AbortController();
      const executor = new AsyncExecutor({ abortController: controller });

      // Start execution with .catch() to prevent unhandled rejection
      const promise = executor.exec({ expression: new Expression('1 + 1'), context: {} }).catch((e) => e);

      // Cancel immediately
      controller.abort(new Error('Cancelled by user'));
      await vi.runAllTimersAsync();

      // Assert
      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Cancelled by user');
    });

    it('example: worker-like runner', async () => {
      // Simple worker simulation - no manual timer/listener management!
      const workerRunner: AsyncRunner = async (job, signal) => {
        // Just check if aborted at start
        if (signal?.aborted)
          throw signal.reason || new Error('Aborted');

        // Simulate some async work
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Check again after work
        if (signal?.aborted)
          throw signal.reason || new Error('Aborted');

        return job();
      };

      const executor = new AsyncExecutor({
        runner: workerRunner,
        timeoutMs: 100,
      });

      const promise = executor.exec({
        expression: new Expression('10 * 5'),
        context: {},
      });

      await vi.advanceTimersByTimeAsync(60);
      const result = await promise;

      expect(result.result).toBeInstanceOf(FormulaNumber);
      if (result.result instanceof FormulaNumber) {
        expect(result.result.value).toBe(50);
      }
    });
  });

  describe('Error Handling', () => {
    it('should propagate formula errors', async () => {
      // Arrange
      const executor = new AsyncExecutor();
      const request: FormulaExecRequest = {
        expression: new Expression('unknownVariable + 1'),
        context: {},
      };

      // Act
      // Add .catch() immediately to prevent unhandled rejection
      const promise = executor.exec(request).catch((e) => e);
      await vi.runAllTimersAsync();

      // Assert
      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain('Variable "unknownVariable" is not defined');
    });

    it('should propagate runner errors', async () => {
      // Arrange
      const errorRunner = vi.fn<AsyncRunner>().mockRejectedValue(new Error('Runner failed'));
      const executor = new AsyncExecutor({ runner: errorRunner });
      const request: FormulaExecRequest = {
        expression: new Expression('test'),
        context: {},
      };

      // Act & Assert
      await expect(executor.exec(request)).rejects.toThrow('Runner failed');
    });
  });
});
