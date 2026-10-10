/* eslint-disable test/prefer-lowercase-title */
import type { FormulaDataType, FormulaRuntimeOptions, NodeAdapter } from 'evalex';

import {
  Expression,
  FormulaNull,
  FormulaNumber,
  FormulaRuntime,
  ImmediateScheduler,
  SyncExecutor,
} from 'evalex';
import { it } from 'vitest';

// Minimal node model for formula tests
interface Node {
  id: string;
  value: FormulaDataType;
  expression?: Expression;
  activeDeps?: Set<string>;
}

/**
 * Benchmark: Simple formula calculation
 * Re-queues one formula, with a changed input (recalculated) and without one (skipped)
 */
it('Simple Formula (A + B)', async ({ bench }) => {
  let initFn: () => Promise<void>;
  let registry: Map<string, Node>;
  let next = 0;

  const createSetup = () => {
    const created = setup();
    created.registry.set('a', { id: 'a', value: new FormulaNumber(10) });
    created.registry.set('b', { id: 'b', value: new FormulaNumber(20) });
    created.registry.set('sum', {
      id: 'sum',
      value: new FormulaNumber(0),
      expression: new Expression('a + b'),
    });
    registry = created.registry;
    initFn = created.initializeFormulas;
  };

  await bench.compare(
    bench(
      'input changed, recalculated',
      { beforeAll: createSetup },
      async () => {
        registry.get('a')!.value = new FormulaNumber(++next);
        await initFn();
      },
    ),
    bench(
      'nothing changed, skipped',
      { beforeAll: createSetup },
      async () => {
        await initFn();
      },
    ),
    { warmupIterations: 10, iterations: 100 },
  );
});

/**
 * Benchmark: Formula chain processing
 * Measures how chain length affects recalculation when the head of the chain changes,
 * and what re-queuing the whole chain costs when nothing changed
 */
it('Formula Chain Processing', async ({ bench }) => {
  let next = 0;

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

    return {
      recalculate: async () => {
        registry.get('f0')!.value = new FormulaNumber(++next);
        await initializeFormulas();
      },
      requeue: initializeFormulas,
    };
  };

  const runs = new Map<string, () => Promise<void>>();

  const chainBench = (chainLength: number, headChanged: boolean) => {
    const name = `chain of ${chainLength}, ${headChanged ? 'head changed, recalculated' : 'nothing changed, skipped'}`;

    return bench(
      name,
      {
        beforeAll: () => {
          const { recalculate, requeue } = createChainSetup(chainLength);
          runs.set(name, headChanged ? recalculate : requeue);
        },
      },
      async () => {
        await runs.get(name)!();
      },
    );
  };

  await bench.compare(
    chainBench(5, true),
    chainBench(10, true),
    chainBench(20, true),
    chainBench(5, false),
    chainBench(10, false),
    chainBench(20, false),
    { warmupIterations: 10, iterations: 100 },
  );
});

/**
 * Benchmark: Dependent formula updates (fan-out)
 * Measures recalculation propagation when the shared input gets a new value,
 * and the cost of an update that repeats the current value
 * Setup includes initial calculation, measures only update time
 */
it('Dependent Formula Updates (fan-out)', async ({ bench }) => {
  const updates = new Map<string, (value: number) => Promise<void>>();
  let next = 20;

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
    return async (value: number) => {
      registry.get('base')!.value = new FormulaNumber(value);
      runtime.enqueueDependents('base');
      await runtime.waitForProcessing();
    };
  };

  const fanOutBench = (dependentCount: number, sameValue: boolean) => {
    const name = `${dependentCount} dependents, ${sameValue ? 'same value, skipped' : 'new value, recalculated'}`;

    return bench(
      name,
      {
        beforeAll: async () => {
          updates.set(name, await createFanOutSetup(dependentCount));
        },
      },
      async () => {
        await updates.get(name)!(sameValue ? 20 : ++next);
      },
    );
  };

  await bench.compare(
    fanOutBench(10, false),
    fanOutBench(50, false),
    fanOutBench(100, false),
    fanOutBench(10, true),
    fanOutBench(50, true),
    fanOutBench(100, true),
    { warmupIterations: 5, iterations: 50 },
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
it('Warm Code, Cold Data (new document)', async ({ bench }) => {
  // Seeded random for reproducible benchmarks
  const seededRandom = (seed: number) => {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  };

  // Local bindings skip the module runner's export getters in the per-formula loops
  const NumberCtor = FormulaNumber;
  const ExpressionCtor = Expression;

  const runColdStart = async (formulaCount: number, baseCount: number) => {
    const random = seededRandom(42);
    const { registry, initializeFormulas } = setup();

    for (let i = 0; i < baseCount; i++) {
      registry.set(`p${i}`, { id: `p${i}`, value: new NumberCtor(i) });
    }

    for (let i = 0; i < formulaCount; i++) {
      const numDeps = Math.floor(random() * 3) + 1;
      const deps = [];
      for (let j = 0; j < numDeps; j++) {
        deps.push(`p${Math.floor(random() * baseCount)}`);
      }
      registry.set(`f${i}`, {
        id: `f${i}`,
        value: new NumberCtor(0),
        expression: new ExpressionCtor(deps.join(' + ')),
      });
    }

    await initializeFormulas();
  };

  await bench.compare(
    bench('100 formulas (10 bases)', async () => {
      await runColdStart(100, 10);
    }),
    bench('500 formulas (50 bases)', async () => {
      await runColdStart(500, 50);
    }),
    bench('1000 formulas (100 bases)', async () => {
      await runColdStart(1000, 100);
    }),
    // warmup prewarms JIT for code paths, data is fresh each time
    { warmupIterations: 3, iterations: 20 },
  );
});

/**
 * Benchmark: Expression complexity
 * Measures recalculation time for expressions with different dependency counts when a shared input changes,
 * and what re-queuing them costs when nothing changed
 */
it('Expression Complexity (same formula count)', async ({ bench }) => {
  const runs = new Map<string, () => Promise<void>>();
  let next = 0;

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

    return {
      // Every formula reads base0, so changing it recalculates all 50
      recalculate: async () => {
        registry.get('base0')!.value = new FormulaNumber(++next);
        await initializeFormulas();
      },
      requeue: initializeFormulas,
    };
  };

  const complexityBench = (depsPerFormula: number, inputChanged: boolean) => {
    const name = `50 formulas, ${depsPerFormula} deps each, ${inputChanged ? 'input changed, recalculated' : 'nothing changed, skipped'}`;

    return bench(
      name,
      {
        beforeAll: () => {
          const { recalculate, requeue } = createComplexitySetup(depsPerFormula);
          runs.set(name, inputChanged ? recalculate : requeue);
        },
      },
      async () => {
        await runs.get(name)!();
      },
    );
  };

  await bench.compare(
    complexityBench(1, true),
    complexityBench(3, true),
    complexityBench(5, true),
    complexityBench(10, true),
    complexityBench(1, false),
    complexityBench(3, false),
    complexityBench(5, false),
    complexityBench(10, false),
    { warmupIterations: 5, iterations: 50 },
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
