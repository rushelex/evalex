import { bench } from 'vitest';

import type { FormulaDataType } from '../../core';
import type { FormulaRuntimeOptions } from '../runtime';
import type { NodeAdapter } from '../types';

import { Expression, FormulaNull, FormulaNumber } from '../../core';
import { SyncExecutor } from '../executor';
import { FormulaRuntime } from '../runtime';
import { ImmediateScheduler } from '../scheduler';

// Minimal node model for formula tests
interface Node {
  id: string;
  value: FormulaDataType;
  expression?: Expression;
  activeDeps?: Set<string>;
}

describe('Runtime Benchmark', () => {
  bench('should calculate simple formula (A + B) in < 5ms', async () => {
    const { registry, initializeFormulas } = setup();

    registry.set('a', { id: 'a', value: new FormulaNumber(10) });
    registry.set('b', { id: 'b', value: new FormulaNumber(20) });
    registry.set('sum', { id: 'sum', value: new FormulaNumber(0), expression: new Expression('a + b') });

    const start = performance.now();
    await initializeFormulas();
    const duration = performance.now() - start;

    const sum = registry.get('sum');
    expect(sum?.value).toEqual(new FormulaNumber(30));
    expect(duration).toBeLessThan(5);
  });

  bench('should calculate 10-formula chain in < 10ms', async () => {
    const { registry, initializeFormulas } = setup();

    registry.set('f0', { id: 'f0', value: new FormulaNumber(1) });

    // Create chain of 10 formulas
    for (let i = 1; i <= 10; i++) {
      registry.set(`f${i}`, {
        id: `f${i}`,
        value: new FormulaNumber(0),
        expression: new Expression(`f${i - 1} + 1`),
      });
    }

    const start = performance.now();
    await initializeFormulas();
    const duration = performance.now() - start;

    const last = registry.get('f10');
    expect(last?.value).toEqual(new FormulaNumber(11));
    expect(duration).toBeLessThan(10);
  });

  bench('should calculate 100-formula graph in < 20ms', async () => {
    const { registry, initializeFormulas } = setup();

    // Create 10 base values
    for (let i = 0; i < 10; i++) {
      registry.set(`base${i}`, { id: `base${i}`, value: new FormulaNumber(i) });
    }

    // Create 100 formulas with various dependencies
    for (let i = 0; i < 100; i++) {
      const deps = [];
      // Each formula depends on 2-3 base values
      for (let j = 0; j < 3; j++) {
        deps.push(`base${Math.floor(Math.random() * 10)}`);
      }
      registry.set(`f${i}`, {
        id: `f${i}`,
        value: new FormulaNumber(0),
        expression: new Expression(deps.join(' + ')),
      });
    }

    const start = performance.now();
    await initializeFormulas();
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(20);
  });

  bench('should complete 50 dependent formulas update in < 20ms', async () => {
    const { registry, runtime, initializeFormulas } = setup();

    registry.set('base', { id: 'base', value: new FormulaNumber(10) });

    // Create 50 formulas that depend on base
    for (let i = 0; i < 50; i++) {
      registry.set(`f${i}`, {
        id: `f${i}`,
        value: new FormulaNumber(0),
        expression: new Expression(`base * ${i + 1}`),
      });
    }

    await initializeFormulas();

    // Measure update time
    const start = performance.now();
    registry.get('base')!.value = new FormulaNumber(20);
    runtime.enqueueDependents('base');
    await runtime.waitForProcessing();
    const duration = performance.now() - start;

    // Verify a sample
    expect(registry.get('f49')?.value).toEqual(new FormulaNumber(1000)); // 20 * 50
    expect(duration).toBeLessThan(20);
  });

  bench('should handle 1000 formulas cold start in < 200ms', async () => {
    const { registry, initializeFormulas } = setup();

    // Create 100 base values
    for (let i = 0; i < 100; i++) {
      registry.set(`p${i}`, { id: `p${i}`, value: new FormulaNumber(i) });
    }

    // Create 1000 formulas
    for (let i = 0; i < 1000; i++) {
      // Random formula complexity
      const numDeps = Math.floor(Math.random() * 5) + 1;
      const deps = [];
      for (let j = 0; j < numDeps; j++) {
        deps.push(`p${Math.floor(Math.random() * 100)}`);
      }
      registry.set(`f${i}`, {
        id: `f${i}`,
        value: new FormulaNumber(0),
        expression: new Expression(deps.join(' + ')),
      });
    }

    const start = performance.now();
    await initializeFormulas();
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(200);
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

  const registry = new Map<string, Node>();

  const runtime = new FormulaRuntime<Node>({
    executor,
    scheduler: new ImmediateScheduler(),
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
    adapter,
    executor,
    registry,
    runtime,
    initializeFormulas,
  };
}
