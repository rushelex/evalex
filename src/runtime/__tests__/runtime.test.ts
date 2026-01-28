import LeakDetector from 'jest-leak-detector';

import type { FormulaDataType } from '../../core';
import type { FormulaExecRequest } from '../executor';
import type { FormulaRuntimeOptions } from '../runtime';
import type { FormulaNode, NodeAdapter } from '../types';

import { Expression, FormulaNull, FormulaNumber } from '../../core';
import { AsyncExecutor, SyncExecutor } from '../executor';
import { FormulaRuntime } from '../runtime';
import { BatchingScheduler, ImmediateScheduler } from '../scheduler';

// Minimal node model for formula tests
interface Node extends FormulaNode {
  value: FormulaDataType;
  expression?: Expression;
  activeDeps?: Set<string>;
}

describe('FormulaRuntime', () => {
  describe('Core Integration', () => {
    it('should calculate a simple formula and update value', async () => {
      const { registry, initializeFormulas } = setup();

      registry.set('a', { id: 'a', value: new FormulaNumber(2) });
      registry.set('b', { id: 'b', value: new FormulaNumber(3) });
      registry.set('c', { id: 'c', value: new FormulaNumber(0), expression: new Expression('a + b') });

      await initializeFormulas();

      const node = registry.get('c');

      expect(node?.value).toBeInstanceOf(FormulaNumber);
      if (node?.value instanceof FormulaNumber) {
        expect(node.value.value).toBe(5);
      }

      expect(node?.activeDeps).toEqual(new Set(['a', 'b']));
    });

    it('should cascade updates to dependent formulas', async () => {
      const { registry, initializeFormulas } = setup();

      registry.set('a', { id: 'a', value: new FormulaNumber(2) });
      registry.set('b', { id: 'b', value: new FormulaNumber(3) });
      registry.set('c', { id: 'c', value: new FormulaNumber(0), expression: new Expression('a + b') });
      registry.set('d', { id: 'd', value: new FormulaNumber(0), expression: new Expression('c * 2') });

      await initializeFormulas();

      const c = registry.get('c');
      const d = registry.get('d');

      expect(c?.value).toBeInstanceOf(FormulaNumber);
      if (c?.value instanceof FormulaNumber) {
        expect(c.value.value).toBe(5);
      }

      expect(d?.value).toBeInstanceOf(FormulaNumber);
      if (d?.value instanceof FormulaNumber) {
        expect(d.value.value).toBe(10);
      }

      expect(d?.activeDeps).toEqual(new Set(['c']));
    });

    it('should update active dependencies when condition changes', async () => {
      const { registry, runtime, initializeFormulas } = setup();

      registry.set('flag', { id: 'flag', value: new FormulaNumber(0) });
      registry.set('a', { id: 'a', value: new FormulaNumber(10) });
      registry.set('b', { id: 'b', value: new FormulaNumber(20) });
      registry.set('res', { id: 'res', value: new FormulaNumber(0), expression: new Expression('if(flag, a, b)') });

      await initializeFormulas();

      const res1 = registry.get('res');

      expect(res1?.value).toBeInstanceOf(FormulaNumber);
      if (res1?.value instanceof FormulaNumber) {
        expect(res1.value.value).toBe(20);
      }

      expect(res1?.activeDeps).toEqual(new Set(['flag', 'b']));

      // Change flag, now formula should depend on 'a'
      registry.get('flag')!.value = new FormulaNumber(1);
      runtime.enqueue('res');
      await runtime.waitForProcessing();

      const res2 = registry.get('res');

      expect(res2?.value).toBeInstanceOf(FormulaNumber);
      if (res2?.value instanceof FormulaNumber) {
        expect(res2.value.value).toBe(10);
      }

      expect(res2?.activeDeps).toEqual(new Set(['flag', 'a']));
    });

    it('should handle formula evaluation error correctly', async () => {
      const { registry, initializeFormulas } = setup();

      registry.set('a', { id: 'a', value: new FormulaNumber(1) });
      registry.set('bad', { id: 'bad', value: new FormulaNumber(0), expression: new Expression('not_a_variable + 1') });

      await initializeFormulas();

      const bad = registry.get('bad');

      expect(bad?.value).toBeInstanceOf(FormulaNull);
      expect(bad?.activeDeps).toBeUndefined();
    });
  });

  describe('Batching Behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should batch multiple enqueue calls within batchDelayMs', async () => {
      // Track how many times processQueue is called
      let processCount = 0;

      const executor = new (class extends SyncExecutor {
        public override exec(request: FormulaExecRequest) {
          processCount++;
          return super.exec(request);
        }
      })();

      const { registry, runtime } = setup({
        executor,
        scheduler: new BatchingScheduler({
          delayMs: 10,
        }),
      });

      // Set up nodes
      registry.set('a', { id: 'a', value: new FormulaNumber(1) });
      registry.set('b', { id: 'b', value: new FormulaNumber(2) });
      registry.set('c', { id: 'c', value: new FormulaNumber(0), expression: new Expression('a + b') });
      registry.set('d', { id: 'd', value: new FormulaNumber(0), expression: new Expression('a * 2') });
      registry.set('e', { id: 'e', value: new FormulaNumber(0), expression: new Expression('b * 3') });

      // Enqueue multiple formulas in quick succession
      runtime.enqueue('c');
      runtime.enqueue('d');
      runtime.enqueue('e');

      // Advance time to trigger batch processing
      await vi.advanceTimersByTimeAsync(10);

      // Wait for batch processing
      await runtime.waitForProcessing();

      // All three formulas should be calculated
      expect(registry.get('c')?.value).toEqual(new FormulaNumber(3));
      expect(registry.get('d')?.value).toEqual(new FormulaNumber(2));
      expect(registry.get('e')?.value).toEqual(new FormulaNumber(6));

      // Should have processed all three in one batch
      expect(processCount).toBe(3);
    });

    it('should process immediately when using ImmediateScheduler', async () => {
      const { registry, runtime } = setup({
        scheduler: new ImmediateScheduler(),
      });

      // Set up nodes
      registry.set('a', { id: 'a', value: new FormulaNumber(5) });
      registry.set('b', { id: 'b', value: new FormulaNumber(0), expression: new Expression('a * 2') });

      // Enqueue formula
      runtime.enqueue('b');

      // Should process immediately
      await runtime.waitForProcessing();

      expect(registry.get('b')?.value).toEqual(new FormulaNumber(10));
    });

    it('should handle multiple setPropertyValue calls during processing', async () => {
      let execCount = 0;
      const executor = new (class extends AsyncExecutor {
        public override async exec(request: FormulaExecRequest) {
          execCount++;
          // Simulate slow async execution
          await new Promise((resolve) => setTimeout(resolve, 50));
          return super.exec(request);
        }
      })();

      const { registry, runtime } = setup({
        executor,
        scheduler: new BatchingScheduler({
          delayMs: 10,
        }),
      });

      // Set up nodes
      registry.set('a', { id: 'a', value: new FormulaNumber(1) });
      registry.set('b', { id: 'b', value: new FormulaNumber(0), expression: new Expression('a * 2') });

      // First enqueue
      runtime.enqueue('b');

      // Advance time to start processing
      await vi.advanceTimersByTimeAsync(10);

      // Change 'a' while processing is happening
      registry.get('a')!.value = new FormulaNumber(5);
      runtime.enqueue('b');

      // Advance time to complete async processing
      await vi.advanceTimersByTimeAsync(100);

      // Wait for all processing to complete
      await runtime.waitForProcessing();

      // Should have the latest value
      expect(registry.get('b')?.value).toEqual(new FormulaNumber(10));

      // Should have executed twice (once for initial, once for update)
      expect(execCount).toBe(2);
    });
  });

  describe('Garbage Collection Cleanup', () => {
    it('should clean graph and registry after properties are GCed', async () => {
      const { registry, runtime } = setup();

      let node: Node | undefined = { id: 'N1', value: new FormulaNumber(1) };
      registry.set(node.id, node);
      runtime.register(node.id, node);

      const detector = new LeakDetector(node);

      runtime.unregister(node);
      registry.delete(node.id);

      node = undefined;

      await runtime.waitForProcessing();

      await expect(detector.isLeaking()).resolves.toBe(false);
    });
  });

  describe('Edge Cases', () => {
    describe('Deep Dependency Chains', () => {
      it('should handle deep formula chains up to 50 levels', async () => {
        const { registry, runtime, initializeFormulas } = setup();

        // Create a deep chain
        registry.set('f0', { id: 'f0', value: new FormulaNumber(1) });

        for (let i = 1; i <= 50; i++) {
          registry.set(`f${i}`, {
            id: `f${i}`,
            value: new FormulaNumber(0),
            expression: new Expression(`f${i - 1} + 1`),
          });
        }

        await initializeFormulas();

        const last = registry.get('f50');
        expect(last?.value).toEqual(new FormulaNumber(51));

        // Update base and verify cascade
        registry.get('f0')!.value = new FormulaNumber(10);
        runtime.enqueue('f1');
        await runtime.waitForProcessing();

        expect(last?.value).toEqual(new FormulaNumber(60));
      });
    });

    describe('Wide Dependency Graphs', () => {
      it('should handle formulas with many dependencies', async () => {
        const { registry, initializeFormulas } = setup();

        // Create 100 base properties
        for (let i = 0; i < 100; i++) {
          registry.set(`p${i}`, { id: `p${i}`, value: new FormulaNumber(i) });
        }

        // Create formula that depends on all 100 properties
        const formula = Array.from({ length: 100 }, (_, i) => `p${i}`).join(' + ');
        registry.set('sum', {
          id: 'sum',
          value: new FormulaNumber(0),
          expression: new Expression(formula),
        });

        await initializeFormulas();

        // Sum of 0 to 99 = 4950
        expect(registry.get('sum')?.value).toEqual(new FormulaNumber(4950));
      });

      it('should handle many formulas depending on single property', async () => {
        const { registry, runtime, initializeFormulas } = setup();

        registry.set('base', { id: 'base', value: new FormulaNumber(10) });

        // Create 50 formulas that all depend on base
        for (let i = 0; i < 50; i++) {
          registry.set(`f${i}`, {
            id: `f${i}`,
            value: new FormulaNumber(0),
            expression: new Expression(`base * ${i + 1}`),
          });
        }

        await initializeFormulas();

        // Verify initial values
        expect(registry.get('f0')?.value).toEqual(new FormulaNumber(10));
        expect(registry.get('f49')?.value).toEqual(new FormulaNumber(500));

        // Update base and verify all formulas recalculate
        registry.get('base')!.value = new FormulaNumber(5);
        runtime.enqueueDependents('base');
        await runtime.waitForProcessing();

        expect(registry.get('f0')?.value).toEqual(new FormulaNumber(5));
        expect(registry.get('f49')?.value).toEqual(new FormulaNumber(250));
      });
    });

    describe('Concurrent Modifications', () => {
      it('should handle rapid value changes', async () => {
        const { registry, runtime, initializeFormulas } = setup();

        registry.set('a', { id: 'a', value: new FormulaNumber(0) });
        registry.set('b', { id: 'b', value: new FormulaNumber(0) });
        registry.set('sum', { id: 'sum', value: new FormulaNumber(0), expression: new Expression('a + b') });

        await initializeFormulas();

        // Rapid changes
        for (let i = 0; i < 10; i++) {
          registry.get('a')!.value = new FormulaNumber(i);
          runtime.enqueue('sum');
          registry.get('b')!.value = new FormulaNumber(i * 2);
          runtime.enqueue('sum');
        }

        await runtime.waitForProcessing();

        // Should have final values
        expect(registry.get('sum')?.value).toEqual(new FormulaNumber(27)); // 9 + 18
      });
    });
  });
});

function setup(options?: Partial<FormulaRuntimeOptions<Node>>) {
  const adapter: NodeAdapter<Node> = {
    shouldProcess: (node) => !!node.expression,
    toFormulaDataType: (node) => node.value,
    toExpression: (node) => node.expression ?? null,
    onCalculate: (node, value, deps) => {
      node.value = value;
      node.activeDeps = deps ? new Set(deps) : undefined;
    },
    onError: (node) => {
      node.value = new FormulaNull();
      node.activeDeps = undefined;
    },
  };

  const executor = new SyncExecutor();

  const scheduler = new ImmediateScheduler();

  const registry = new Map<string, Node>();

  const runtime = new FormulaRuntime<Node>({
    executor,
    scheduler,
    adapter,
    nodeProvider: (id) => registry.get(id),
    ...options,
  });

  // Function to initialize formulas and start calculations
  async function initializeFormulas() {
    // Enqueue all formulas for initial calculation
    // FormulaRuntime will automatically extract dependencies
    for (const [nodeId, node] of registry.entries()) {
      if (adapter.shouldProcess(node)) {
        runtime.enqueue(nodeId);
      }
    }

    // Wait for processing to complete
    await runtime.waitForProcessing();
  }

  return {
    executor,
    scheduler,
    adapter,
    registry,
    runtime,
    initializeFormulas,
  };
}
