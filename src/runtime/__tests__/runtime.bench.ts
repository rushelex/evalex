import { bench, describe } from 'vitest';

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

/**
 * Benchmark: Simple formula calculation
 * Measures pure evaluation time without setup overhead
 */
describe('Simple Formula (A + B)', () => {
  let initFn: () => Promise<void>;

  bench(
    'evaluation only',
    async () => {
      await initFn();
    },
    {
      warmupIterations: 10,
      iterations: 100,
      setup: () => {
        const { registry, initializeFormulas } = setup();
        registry.set('a', { id: 'a', value: new FormulaNumber(10) });
        registry.set('b', { id: 'b', value: new FormulaNumber(20) });
        registry.set('sum', {
          id: 'sum',
          value: new FormulaNumber(0),
          expression: new Expression('a + b'),
        });
        initFn = initializeFormulas;
      },
    },
  );
});

/**
 * Benchmark: Formula chain processing
 * Measures how chain length affects evaluation time
 */
describe('Formula Chain Processing', () => {
  let initFn5: () => Promise<void>;
  let initFn10: () => Promise<void>;
  let initFn20: () => Promise<void>;

  const createChainSetup = (chainLength: number) => {
    const { registry, initializeFormulas } = setup();
    registry.set('f0', { id: 'f0', value: new FormulaNumber(1) });

    for (let i = 1; i <= chainLength; i++) {
      registry.set(`f${i}`, {
        id: `f${i}`,
        value: new FormulaNumber(0),
        expression: new Expression(`f${i - 1} + 1`),
      });
    }
    return initializeFormulas;
  };

  bench(
    'chain of 5 formulas',
    async () => {
      await initFn5();
    },
    {
      warmupIterations: 10,
      iterations: 100,
      setup: () => {
        initFn5 = createChainSetup(5);
      },
    },
  );

  bench(
    'chain of 10 formulas',
    async () => {
      await initFn10();
    },
    {
      warmupIterations: 10,
      iterations: 100,
      setup: () => {
        initFn10 = createChainSetup(10);
      },
    },
  );

  bench(
    'chain of 20 formulas',
    async () => {
      await initFn20();
    },
    {
      warmupIterations: 10,
      iterations: 100,
      setup: () => {
        initFn20 = createChainSetup(20);
      },
    },
  );
});

/**
 * Benchmark: Dependent formula updates (fan-out)
 * Measures recalculation propagation performance
 * Setup includes initial calculation, measures only update time
 */
describe('Dependent Formula Updates (fan-out)', () => {
  let updateFn10: () => Promise<void>;
  let updateFn50: () => Promise<void>;
  let updateFn100: () => Promise<void>;

  const createFanOutSetup = async (dependentCount: number) => {
    const { registry, runtime, initializeFormulas } = setup();
    registry.set('base', { id: 'base', value: new FormulaNumber(10) });

    for (let i = 0; i < dependentCount; i++) {
      registry.set(`f${i}`, {
        id: `f${i}`,
        value: new FormulaNumber(0),
        expression: new Expression(`base * ${i + 1}`),
      });
    }

    // Initial calculation is part of setup
    await initializeFormulas();

    // Return only the update function to measure
    return async () => {
      registry.get('base')!.value = new FormulaNumber(20);
      runtime.enqueueDependents('base');
      await runtime.waitForProcessing();
    };
  };

  bench(
    'update with 10 dependents',
    async () => {
      await updateFn10();
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: async () => {
        updateFn10 = await createFanOutSetup(10);
      },
    },
  );

  bench(
    'update with 50 dependents',
    async () => {
      await updateFn50();
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: async () => {
        updateFn50 = await createFanOutSetup(50);
      },
    },
  );

  bench(
    'update with 100 dependents',
    async () => {
      await updateFn100();
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: async () => {
        updateFn100 = await createFanOutSetup(100);
      },
    },
  );
});

/**
 * Benchmark: Cold start performance
 * Measures FULL initialization time including object creation.
 *
 * NOTE: warmupIterations here prewarms V8's JIT compiler for the CODE PATHS,
 * not the DATA. Each iteration creates fresh runtime/registry/formulas.
 * This simulates "app is warm, but user opens new document with 1000 formulas".
 *
 * For TRUE cold start (first ever run), you'd need a separate process per measurement,
 * which vitest bench doesn't support. Use manual benchmarking for that.
 */
describe('Warm Code, Cold Data (new document)', () => {
  // Seeded random for reproducible benchmarks
  const seededRandom = (seed: number) => {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  };

  const runColdStart = async (formulaCount: number, baseCount: number) => {
    const random = seededRandom(42);
    const { registry, initializeFormulas } = setup();

    for (let i = 0; i < baseCount; i++) {
      registry.set(`p${i}`, { id: `p${i}`, value: new FormulaNumber(i) });
    }

    for (let i = 0; i < formulaCount; i++) {
      const numDeps = Math.floor(random() * 3) + 1;
      const deps = [];
      for (let j = 0; j < numDeps; j++) {
        deps.push(`p${Math.floor(random() * baseCount)}`);
      }
      registry.set(`f${i}`, {
        id: `f${i}`,
        value: new FormulaNumber(0),
        expression: new Expression(deps.join(' + ')),
      });
    }

    await initializeFormulas();
  };

  bench(
    '100 formulas (10 bases)',
    async () => {
      await runColdStart(100, 10);
    },
    // warmup prewarms JIT for code paths, data is fresh each time
    { warmupIterations: 3, iterations: 20 },
  );

  bench(
    '500 formulas (50 bases)',
    async () => {
      await runColdStart(500, 50);
    },
    { warmupIterations: 3, iterations: 20 },
  );

  bench(
    '1000 formulas (100 bases)',
    async () => {
      await runColdStart(1000, 100);
    },
    { warmupIterations: 3, iterations: 20 },
  );
});

/**
 * Benchmark: Expression complexity
 * Measures evaluation time for expressions with different dependency counts
 */
describe('Expression Complexity (same formula count)', () => {
  let initFn1: () => Promise<void>;
  let initFn3: () => Promise<void>;
  let initFn5: () => Promise<void>;
  let initFn10: () => Promise<void>;

  const createComplexitySetup = (depsPerFormula: number) => {
    const { registry, initializeFormulas } = setup();

    for (let i = 0; i < 10; i++) {
      registry.set(`base${i}`, { id: `base${i}`, value: new FormulaNumber(i + 1) });
    }

    for (let i = 0; i < 50; i++) {
      const deps = [];
      for (let j = 0; j < depsPerFormula; j++) {
        deps.push(`base${j % 10}`);
      }
      registry.set(`f${i}`, {
        id: `f${i}`,
        value: new FormulaNumber(0),
        expression: new Expression(deps.join(' + ')),
      });
    }

    return initializeFormulas;
  };

  bench(
    '50 formulas, 1 dep each',
    async () => {
      await initFn1();
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: () => {
        initFn1 = createComplexitySetup(1);
      },
    },
  );

  bench(
    '50 formulas, 3 deps each',
    async () => {
      await initFn3();
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: () => {
        initFn3 = createComplexitySetup(3);
      },
    },
  );

  bench(
    '50 formulas, 5 deps each',
    async () => {
      await initFn5();
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: () => {
        initFn5 = createComplexitySetup(5);
      },
    },
  );

  bench(
    '50 formulas, 10 deps each',
    async () => {
      await initFn10();
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: () => {
        initFn10 = createComplexitySetup(10);
      },
    },
  );
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

  async function initializeFormulas() {
    for (const [nodeId, node] of registry.entries()) {
      if (adapter.shouldProcess(node)) {
        runtime.enqueue(nodeId);
      }
    }
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
