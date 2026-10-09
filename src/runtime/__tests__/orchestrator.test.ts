import type { FormulaDataType } from '../../core';
import type { Scheduler } from '../scheduler';
import type { FormulaNode, NodeAdapter } from '../types';

import { vi } from 'vitest';

import { Expression, FormulaArray, FormulaNull, FormulaNumber } from '../../core';
import { Errors } from '../../core/errors';
import { SyncExecutor } from '../executor';
import { FORMULA_LIMITS } from '../limits';
import { FormulaOrchestrator } from '../orchestrator';

// Test node type
interface TestNode extends FormulaNode {
  value: FormulaDataType;
  error: Error | null;
  expression?: Expression;
}

describe(FormulaOrchestrator, () => {
  let orchestrator: FormulaOrchestrator<TestNode>;
  let adapter: NodeAdapter<TestNode>;

  beforeEach(() => {
    adapter = {
      shouldProcess: (node) => !!node.expression,
      toFormulaDataType: (node) => node.value,
      toExpression: (node) => node.expression ?? null,
      onCalculate: (node, value) => {
        node.value = value;
      },
      onError: (node, error) => {
        node.value = new FormulaNull();
        node.error = error;
      },
    };

    orchestrator = new FormulaOrchestrator({
      adapter,
      executor: new SyncExecutor(),
    });
  });

  describe('add', () => {
    it('should add a node successfully', () => {
      const node: TestNode = { id: 'test1', value: new FormulaNumber(42), error: null };

      orchestrator.add(node);

      expect(orchestrator.has(node.id)).toBe(true);
      expect(orchestrator.get(node.id)).toBe(node);
    });

    it('should throw error when adding node with duplicate ID', () => {
      const node1: TestNode = { id: 'test1', value: new FormulaNumber(1), error: null };
      const node2: TestNode = { id: 'test1', value: new FormulaNumber(2), error: null };

      orchestrator.add(node1);

      expect(() => orchestrator.add(node2)).toThrow('Node with id "test1" already exists');
    });

    it('should set up subscription when provided', () => {
      const node: TestNode = { id: 'test1', value: new FormulaNumber(1), error: null };
      const unsubscribe = vi.fn();
      const subscribe = vi.fn().mockReturnValue(unsubscribe);

      orchestrator.add(node, subscribe);

      expect(subscribe).toHaveBeenCalledOnce();
    });

    it('should enqueue formula nodes automatically', async () => {
      const plainNode: TestNode = { id: 'a', value: new FormulaNumber(5), error: null };
      const formulaNode: TestNode = { id: 'b', value: new FormulaNumber(0), expression: new Expression('a * 2'), error: null };

      orchestrator.add(plainNode);
      orchestrator.add(formulaNode);

      await orchestrator.waitForProcessing();

      expect(formulaNode.value).toEqual(new FormulaNumber(10));
    });
  });

  describe('remove', () => {
    it('should remove existing node and return true', () => {
      const node: TestNode = { id: 'test1', value: new FormulaNumber(42), error: null };

      orchestrator.add(node);
      const removed = orchestrator.remove(node.id);

      expect(removed).toBe(true);
      expect(orchestrator.has(node.id)).toBe(false);
      expect(orchestrator.get(node.id)).toBeUndefined();
    });

    it('should return false when removing non-existent node', () => {
      const removed = orchestrator.remove('non-existent');

      expect(removed).toBe(false);
    });

    it('should clean up subscription on remove', () => {
      const node: TestNode = { id: 'test1', value: new FormulaNumber(1), error: null };
      const unsubscribe = vi.fn();
      const subscribe = vi.fn().mockReturnValue(unsubscribe);

      orchestrator.add(node, subscribe);
      orchestrator.remove(node.id);

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should remove node from dependency graph', async () => {
      const a: TestNode = { id: 'a', value: new FormulaNumber(5), error: null };
      const b: TestNode = { id: 'b', value: new FormulaNumber(0), expression: new Expression('a * 2'), error: null };
      const c: TestNode = { id: 'c', value: new FormulaNumber(0), expression: new Expression('b + 3'), error: null };

      orchestrator.add(a);
      orchestrator.add(b);
      orchestrator.add(c);

      await orchestrator.waitForProcessing();

      // Remove b - should break the chain
      orchestrator.remove('b');

      // Change a - c should not update since b is gone
      a.value = new FormulaNumber(10);
      orchestrator.enqueue('a');

      await orchestrator.waitForProcessing();

      // c should still have old value since b is removed
      expect(c.value).toEqual(new FormulaNumber(13)); // Old value: (5*2)+3
    });
  });

  describe('Basic Operations', () => {
    it('should get node by ID', () => {
      const node: TestNode = { id: 'test1', value: new FormulaNumber(42), error: null };

      orchestrator.add(node);

      expect(orchestrator.get('test1')).toBe(node);
      expect(orchestrator.get('non-existent')).toBeUndefined();
    });

    it('should check if node exists', () => {
      const node: TestNode = { id: 'test1', value: new FormulaNumber(42), error: null };

      orchestrator.add(node);

      expect(orchestrator.has('test1')).toBe(true);
      expect(orchestrator.has('non-existent')).toBe(false);
    });

    it('should get all node IDs', () => {
      const node1: TestNode = { id: 'test1', value: new FormulaNumber(1), error: null };
      const node2: TestNode = { id: 'test2', value: new FormulaNumber(2), error: null };
      const node3: TestNode = { id: 'test3', value: new FormulaNumber(3), error: null };

      orchestrator.add(node1);
      orchestrator.add(node2);
      orchestrator.add(node3);

      const ids = orchestrator.getAllIds();

      expect(ids).toHaveLength(3);
      expect(ids).toContain('test1');
      expect(ids).toContain('test2');
      expect(ids).toContain('test3');
    });

    it('should pass a callback result type error to onError as a formula error', async () => {
      const node: TestNode = { id: 'a', value: new FormulaNumber(0), expression: new Expression('filter([1], 2)'), error: null };

      orchestrator.add(node);
      await orchestrator.waitForProcessing();

      expect(Errors.Argument.CallbackReturnTypeMismatch.is(node.error)).toBe(true);
    });
  });

  describe('Queue Management', () => {
    it('should enqueue node for processing', async () => {
      const a: TestNode = { id: 'a', value: new FormulaNumber(5), error: null };
      const b: TestNode = { id: 'b', value: new FormulaNumber(0), expression: new Expression('a * 2'), error: null };

      orchestrator.add(a);
      orchestrator.add(b);

      await orchestrator.waitForProcessing();

      // Change a but don't enqueue - b should not update
      a.value = new FormulaNumber(10);

      expect(b.value).toEqual(new FormulaNumber(10)); // Still old value

      // Now enqueue manually
      orchestrator.enqueue('b');
      await orchestrator.waitForProcessing();

      expect(b.value).toEqual(new FormulaNumber(20)); // Updated value
    });

    it('should enqueue dependents of a node', async () => {
      const a: TestNode = { id: 'a', value: new FormulaNumber(5), error: null };
      const b: TestNode = { id: 'b', value: new FormulaNumber(0), expression: new Expression('a * 2'), error: null };
      const c: TestNode = { id: 'c', value: new FormulaNumber(0), expression: new Expression('a + 3'), error: null };
      const d: TestNode = { id: 'd', value: new FormulaNumber(0), expression: new Expression('b + c'), error: null };

      orchestrator.add(a);
      orchestrator.add(b);
      orchestrator.add(c);
      orchestrator.add(d);

      await orchestrator.waitForProcessing();

      expect(b.value).toEqual(new FormulaNumber(10)); // 5 * 2
      expect(c.value).toEqual(new FormulaNumber(8)); // 5 + 3
      expect(d.value).toEqual(new FormulaNumber(18)); // 10 + 8

      // Change a and enqueue its dependents
      a.value = new FormulaNumber(10);
      orchestrator.enqueueDependents('a');

      await orchestrator.waitForProcessing();

      // All dependents should update
      expect(b.value).toEqual(new FormulaNumber(20)); // 10 * 2
      expect(c.value).toEqual(new FormulaNumber(13)); // 10 + 3
      expect(d.value).toEqual(new FormulaNumber(33)); // 20 + 13
    });
  });

  describe('Circular Dependencies', () => {
    it('should handle error when creating direct circular dependency', async () => {
      const a: TestNode = { id: 'a', value: new FormulaNumber(0), expression: new Expression('b + 1'), error: null };
      const b: TestNode = { id: 'b', value: new FormulaNumber(0), expression: new Expression('a * 2'), error: null };

      orchestrator.add(a);
      orchestrator.add(b);

      await orchestrator.waitForProcessing();

      // Node a processes first and succeeds (b + 1 = 0 + 1 = 1)
      expect(a.value).toBeInstanceOf(FormulaNumber);
      if (a.value instanceof FormulaNumber) {
        expect(a.value.value).toBe(1);
      }
      expect(a.error).toBeNull();

      // Node b processes second and fails with circular dependency error
      expect(b.value).toBeInstanceOf(FormulaNull);
      expect(Errors.Runtime.CircularDependency.is(b.error)).toBe(true);
    });

    it('should handle error when creating indirect circular dependency', async () => {
      const a: TestNode = { id: 'a', value: new FormulaNumber(0), expression: new Expression('b + 1'), error: null };
      const b: TestNode = { id: 'b', value: new FormulaNumber(0), expression: new Expression('c * 2'), error: null };
      const c: TestNode = { id: 'c', value: new FormulaNumber(0), expression: new Expression('a / 2'), error: null };

      orchestrator.add(a);
      orchestrator.add(b);
      orchestrator.add(c);

      await orchestrator.waitForProcessing();

      // Processing order: a -> b -> c
      // Node a processes first and succeeds (b + 1 = 0 + 1 = 1)
      expect(a.value).toBeInstanceOf(FormulaNumber);
      if (a.value instanceof FormulaNumber) {
        expect(a.value.value).toBe(1);
      }
      expect(a.error).toBeNull();

      // Node b processes second and succeeds (c * 2 = 0 * 2 = 0)
      expect(b.value).toBeInstanceOf(FormulaNumber);
      if (b.value instanceof FormulaNumber) {
        expect(b.value.value).toBe(0);
      }
      expect(b.error).toBeNull();

      // Node c processes third and fails with circular dependency error (a/2 would create cycle a -> b -> c -> a)
      expect(c.value).toBeInstanceOf(FormulaNull);
      expect(Errors.Runtime.CircularDependency.is(c.error)).toBe(true);
    });

    it('should recover when circular dependency is resolved', async () => {
      const num: TestNode = { id: 'num', value: new FormulaNumber(5), error: null };
      const a: TestNode = { id: 'a', value: new FormulaNumber(0), expression: new Expression('b + 1'), error: null };
      const b: TestNode = { id: 'b', value: new FormulaNumber(0), expression: new Expression('a * 2'), error: null }; // Creates cycle

      orchestrator.add(num);
      orchestrator.add(a);
      orchestrator.add(b);

      await orchestrator.waitForProcessing();

      // Node a processes first and succeeds (b + 1 = 0 + 1 = 1)
      expect(a.value).toBeInstanceOf(FormulaNumber);
      if (a.value instanceof FormulaNumber) {
        expect(a.value.value).toBe(1);
      }
      expect(a.error).toBeNull();

      // Node b processes second and fails with circular dependency error
      expect(b.value).toBeInstanceOf(FormulaNull);
      expect(Errors.Runtime.CircularDependency.is(b.error)).toBe(true);

      // Set fixed cycle by changing b's formula
      b.expression = new Expression('num * 2');
      b.error = null; // Reset error state
      orchestrator.enqueue('b');
      await orchestrator.waitForProcessing();

      // Now b should calculate correctly
      expect(b.value).toEqual(new FormulaNumber(10)); // 5 * 2
      expect(b.error).toBeNull();

      // Need to re-enqueue 'a' since its dependency is now valid
      orchestrator.enqueue('a');
      await orchestrator.waitForProcessing();

      expect(a.value).toEqual(new FormulaNumber(11)); // 10 + 1
    });
  });

  describe('Cascade Updates', () => {
    it('should handle deep cascade updates correctly', async () => {
      // Create a chain: a -> b = a * 2 -> c = b + 3 -> d = c / 2
      const a: TestNode = { id: 'a', value: new FormulaNumber(10), error: null };
      const b: TestNode = { id: 'b', value: new FormulaNumber(0), expression: new Expression('a * 2'), error: null };
      const c: TestNode = { id: 'c', value: new FormulaNumber(0), expression: new Expression('b + 3'), error: null };
      const d: TestNode = { id: 'd', value: new FormulaNumber(0), expression: new Expression('c / 2'), error: null };

      orchestrator.add(a);
      orchestrator.add(b);
      orchestrator.add(c);
      orchestrator.add(d);

      await orchestrator.waitForProcessing();

      // Check initial values
      expect(b.value).toEqual(new FormulaNumber(20)); // 10 * 2
      expect(c.value).toEqual(new FormulaNumber(23)); // 20 + 3
      expect(d.value).toEqual(new FormulaNumber(11.5)); // 23 / 2

      // Update 'a' and wait for cascade
      a.value = new FormulaNumber(5);
      orchestrator.enqueueDependents('a');
      await orchestrator.waitForProcessing();

      // Check cascade updates
      expect(b.value).toEqual(new FormulaNumber(10)); // 5 * 2
      expect(c.value).toEqual(new FormulaNumber(13)); // 10 + 3
      expect(d.value).toEqual(new FormulaNumber(6.5)); // 13 / 2
    });

    it('should not recalculate a formula when a node named like a callback variable changes', async () => {
      const items: TestNode = { id: 'items', value: FormulaArray.from([1, 2]), error: null };
      const index: TestNode = { id: 'index', value: new FormulaNumber(100), error: null };
      const total: TestNode = { id: 'total', value: new FormulaNumber(0), expression: new Expression('items.map(current * index).sum()'), error: null };
      const onCalculate = vi.spyOn(adapter, 'onCalculate');

      orchestrator.add(items);
      orchestrator.add(index);
      orchestrator.add(total);
      await orchestrator.waitForProcessing();
      onCalculate.mockClear();

      index.value = new FormulaNumber(200);
      orchestrator.enqueueDependents('index');
      await orchestrator.waitForProcessing();

      expect(total.value).toEqual(new FormulaNumber(2));
      expect(onCalculate).not.toHaveBeenCalled();
    });

    it('should handle multiple property changes in a batch', async () => {
      // Create properties with formulas
      const x: TestNode = { id: 'x', value: new FormulaNumber(1), error: null };
      const y: TestNode = { id: 'y', value: new FormulaNumber(2), error: null };
      const sum: TestNode = { id: 'sum', value: new FormulaNumber(0), expression: new Expression('x + y'), error: null };
      const product: TestNode = { id: 'product', value: new FormulaNumber(0), expression: new Expression('x * y'), error: null };
      const combined: TestNode = { id: 'combined', value: new FormulaNumber(0), expression: new Expression('sum + product'), error: null };

      orchestrator.add(x);
      orchestrator.add(y);
      orchestrator.add(sum);
      orchestrator.add(product);
      orchestrator.add(combined);

      await orchestrator.waitForProcessing();

      // Check initial values
      expect(sum.value).toEqual(new FormulaNumber(3)); // 1 + 2
      expect(product.value).toEqual(new FormulaNumber(2)); // 1 * 2
      expect(combined.value).toEqual(new FormulaNumber(5)); // 3 + 2

      // Update both x and y
      x.value = new FormulaNumber(3);
      orchestrator.enqueueDependents('x');
      y.value = new FormulaNumber(4);
      orchestrator.enqueueDependents('y');

      await orchestrator.waitForProcessing();

      // Check cascade updates
      expect(sum.value).toEqual(new FormulaNumber(7)); // 3 + 4
      expect(product.value).toEqual(new FormulaNumber(12)); // 3 * 4
      expect(combined.value).toEqual(new FormulaNumber(19)); // 7 + 12
    });

    it('should handle diamond dependency pattern', async () => {
      // Create diamond pattern: a -> b,c -> d
      const a: TestNode = { id: 'a', value: new FormulaNumber(10), error: null };
      const b: TestNode = { id: 'b', value: new FormulaNumber(0), expression: new Expression('a * 2'), error: null };
      const c: TestNode = { id: 'c', value: new FormulaNumber(0), expression: new Expression('a + 5'), error: null };
      const d: TestNode = { id: 'd', value: new FormulaNumber(0), expression: new Expression('b + c'), error: null };

      orchestrator.add(a);
      orchestrator.add(b);
      orchestrator.add(c);
      orchestrator.add(d);

      await orchestrator.waitForProcessing();

      expect(d.value).toEqual(new FormulaNumber(35)); // (10*2) + (10+5)

      // Update base
      a.value = new FormulaNumber(5);
      orchestrator.enqueueDependents('a');
      await orchestrator.waitForProcessing();

      expect(b.value).toEqual(new FormulaNumber(10)); // 5 * 2
      expect(c.value).toEqual(new FormulaNumber(10)); // 5 + 5
      expect(d.value).toEqual(new FormulaNumber(20)); // 10 + 10
    });
  });

  describe('Runtime Limits', () => {
    describe('Max Formulas Count', () => {
      it('should throw when exceeding maximum formulas count', () => {
        // Add MAX_FORMULAS_COUNT formulas
        for (let i = 0; i < FORMULA_LIMITS.MAX_FORMULAS_COUNT; i++) {
          orchestrator.add({
            id: `f${i}`,
            value: new FormulaNumber(0),
            expression: new Expression('1 + 1'),
            error: null,
          });
        }

        // Adding one more should throw
        expect(() => {
          orchestrator.add({
            id: 'overflow',
            value: new FormulaNumber(0),
            expression: new Expression('2 + 2'),
            error: null,
          });
        }).toThrow(Errors.Runtime.MaxFormulas.create({
          nodeId: 'overflow',
          count: FORMULA_LIMITS.MAX_FORMULAS_COUNT,
          limit: FORMULA_LIMITS.MAX_FORMULAS_COUNT,
        }));
      });

      it('should allow adding non-formula nodes without limit', () => {
        // Add MAX_FORMULAS_COUNT formulas
        for (let i = 0; i < FORMULA_LIMITS.MAX_FORMULAS_COUNT; i++) {
          orchestrator.add({
            id: `f${i}`,
            value: new FormulaNumber(0),
            expression: new Expression('1 + 1'),
            error: null,
          });
        }

        // Should still allow adding plain nodes
        expect(() => {
          orchestrator.add({
            id: 'plain',
            value: new FormulaNumber(42),
            error: null,
          });
        }).not.toThrow();
      });
    });

    describe('Max Dependencies per Formula', () => {
      it('should throw when formula has too many dependencies', async () => {
        // Create base nodes
        for (let i = 0; i < FORMULA_LIMITS.MAX_DEPENDENCIES_PER_FORMULA + 5; i++) {
          orchestrator.add({
            id: `n${i}`,
            value: new FormulaNumber(i),
            error: null,
          });
        }

        // Create formula with too many dependencies
        const deps = Array.from(
          { length: FORMULA_LIMITS.MAX_DEPENDENCIES_PER_FORMULA + 1 },
          (_, i) => `n${i}`,
        ).join(' + ');

        orchestrator.add({
          id: 'formula',
          value: new FormulaNumber(0),
          expression: new Expression(deps),
          error: null,
        });

        await orchestrator.waitForProcessing();

        // Formula should have error due to too many dependencies
        const formula = orchestrator.get('formula');
        expect(formula?.value).toBeInstanceOf(FormulaNull);
        if (Errors.Runtime.MaxDependencies.is(formula?.error)) {
          expect(formula.error).toEqual(Errors.Runtime.MaxDependencies.create({
            nodeId: 'formula',
            count: FORMULA_LIMITS.MAX_DEPENDENCIES_PER_FORMULA + 1,
            limit: FORMULA_LIMITS.MAX_DEPENDENCIES_PER_FORMULA,
          }));
        }
        else {
          throw new Error('Formula should have Errors.Runtime.MaxDependencies error');
        }
      });

      it('should allow formula with exactly MAX_DEPENDENCIES_PER_FORMULA dependencies', async () => {
        // Create base nodes
        for (let i = 0; i < FORMULA_LIMITS.MAX_DEPENDENCIES_PER_FORMULA; i++) {
          orchestrator.add({
            id: `n${i}`,
            value: new FormulaNumber(1),
            error: null,
          });
        }

        // Create formula with exactly max dependencies
        const deps = Array.from(
          { length: FORMULA_LIMITS.MAX_DEPENDENCIES_PER_FORMULA },
          (_, i) => `n${i}`,
        ).join(' + ');

        orchestrator.add({
          id: 'formula',
          value: new FormulaNumber(0),
          expression: new Expression(deps),
          error: null,
        });

        await orchestrator.waitForProcessing();

        // Formula should calculate successfully
        const formula = orchestrator.get('formula');
        expect(formula?.value).toBeInstanceOf(FormulaNumber);
        expect(formula?.error).toBe(null);
      });
    });

    describe('Max Formula Depth', () => {
      it('should handle formulas up to MAX_FORMULA_DEPTH', async () => {
        // Create a chain up to max depth
        orchestrator.add({ id: 'f0', value: new FormulaNumber(1), error: null });

        for (let i = 1; i < FORMULA_LIMITS.MAX_FORMULA_DEPTH; i++) {
          orchestrator.add({
            id: `f${i}`,
            value: new FormulaNumber(0),
            expression: new Expression(`f${i - 1} + 1`),
            error: null,
          });
        }

        await orchestrator.waitForProcessing();

        const lastFormula = orchestrator.get(`f${FORMULA_LIMITS.MAX_FORMULA_DEPTH - 1}`);
        expect(lastFormula?.value).toBeInstanceOf(FormulaNumber);
        if (lastFormula?.value instanceof FormulaNumber) {
          expect(lastFormula.value.value).toBe(FORMULA_LIMITS.MAX_FORMULA_DEPTH);
        }
      });

      it('should throw when exceeding MAX_FORMULA_DEPTH', async () => {
        // Create a chain exceeding max depth
        orchestrator.add({ id: 'f0', value: new FormulaNumber(1), error: null });

        for (let i = 1; i <= FORMULA_LIMITS.MAX_FORMULA_DEPTH + 5; i++) {
          orchestrator.add({
            id: `f${i}`,
            value: new FormulaNumber(0),
            expression: new Expression(`f${i - 1} + 1`),
            error: null,
          });
        }

        await orchestrator.waitForProcessing();

        // At least one formula in the chain should have depth error
        let hasDepthError = false;
        for (let i = FORMULA_LIMITS.MAX_FORMULA_DEPTH; i <= FORMULA_LIMITS.MAX_FORMULA_DEPTH + 5; i++) {
          const formula = orchestrator.get(`f${i}`);
          if (Errors.Runtime.MaxFormulaDepth.is(formula?.error)) {
            hasDepthError = true;
            break;
          }
        }
        expect(hasDepthError).toBe(true);
      });
    });
  });

  describe('Integration with FormulaRuntime', () => {
    it('should pass scheduler to runtime', async () => {
      const batchingScheduler: Scheduler = {
        scheduleIfIdle: vi.fn().mockReturnValue(true),
        markProcessingStarted: vi.fn(),
        markProcessingComplete: vi.fn(),
        getProcessingPromise: vi.fn().mockReturnValue(null),
      };

      const orchestratorWithScheduler = new FormulaOrchestrator({
        adapter,
        executor: new SyncExecutor(),
        scheduler: batchingScheduler,
      });

      const node: TestNode = { id: 'test', value: new FormulaNumber(0), expression: new Expression('1 + 1'), error: null };
      orchestratorWithScheduler.add(node);

      expect(batchingScheduler.scheduleIfIdle).toHaveBeenCalled();
    });

    it('should wait for all processing to complete', async () => {
      const a: TestNode = { id: 'a', value: new FormulaNumber(1), error: null };
      const b: TestNode = { id: 'b', value: new FormulaNumber(0), expression: new Expression('a + 1'), error: null };
      const c: TestNode = { id: 'c', value: new FormulaNumber(0), expression: new Expression('b + 1'), error: null };

      orchestrator.add(a);
      orchestrator.add(b);
      orchestrator.add(c);

      await orchestrator.waitForProcessing();

      expect(b.value).toEqual(new FormulaNumber(2));
      expect(c.value).toEqual(new FormulaNumber(3));
    });
  });
});
