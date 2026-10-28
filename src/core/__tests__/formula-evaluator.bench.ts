/* eslint-disable test/prefer-lowercase-title */
import type { FormulaEvaluator } from 'evalex';

import { Formula, FormulaScope } from 'evalex';
import { it } from 'vitest';

const scope = new FormulaScope();

/**
 * Benchmark: Simple formula calculation
 * Evaluates one formula again, with a changed input (recalculated) and without one (kept)
 */
it('Simple Formula (a + b)', async ({ bench }) => {
  let evaluator: FormulaEvaluator;
  let data: { a: number; b: number; sum: Formula };
  let next = 0;

  const createSetup = (): void => {
    evaluator = scope.evaluator();
    data = { a: 10, b: 20, sum: new Formula('a + b') };
    evaluator.evaluate(data);
  };

  await bench.compare(
    bench('input changed, recalculated', { beforeAll: createSetup }, () => {
      data.a = ++next;
      evaluator.evaluate(data);
    }),
    bench('nothing changed, kept', { beforeAll: createSetup }, () => {
      evaluator.evaluate(data);
    }),
    { warmupIterations: 10, iterations: 100 },
  );
});

/**
 * Benchmark: Formula chain processing
 * Measures how chain length affects recalculation when the head of the chain changes,
 * and what a pass over the whole chain costs when nothing changed
 */
it('Formula Chain Processing', async ({ bench }) => {
  const runs = new Map<string, () => void>();
  let next = 0;

  const createChainSetup = (chainLength: number): { recalculate: () => void; again: () => void } => {
    const evaluator = scope.evaluator();
    const data: Record<string, number | Formula> = { f0: 1 };

    for (let i = 1; i <= chainLength; i++) {
      data[`f${i}`] = new Formula(`f${i - 1} + 1`);
    }

    evaluator.evaluate(data);

    return {
      recalculate: () => {
        data.f0 = ++next;
        evaluator.evaluate(data);
      },
      again: () => evaluator.evaluate(data),
    };
  };

  const chainBench = (chainLength: number, headChanged: boolean) => {
    const name = `chain of ${chainLength}, ${headChanged ? 'head changed, recalculated' : 'nothing changed, kept'}`;

    return bench(
      name,
      {
        beforeAll: () => {
          const { recalculate, again } = createChainSetup(chainLength);

          runs.set(name, headChanged ? recalculate : again);
        },
      },
      () => runs.get(name)!(),
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
 */
it('Dependent Formula Updates (fan-out)', async ({ bench }) => {
  const updates = new Map<string, (value: number) => void>();
  let next = 20;

  const createFanOutSetup = (dependentCount: number): ((value: number) => void) => {
    const evaluator = scope.evaluator();
    const data: Record<string, number | Formula> = { base: 10 };

    for (let i = 0; i < dependentCount; i++) {
      data[`f${i}`] = new Formula(`base * ${i + 1}`);
    }

    evaluator.evaluate(data);

    return (value) => {
      data.base = value;
      evaluator.evaluate(data);
    };
  };

  const fanOutBench = (dependentCount: number, sameValue: boolean) => {
    const name = `${dependentCount} dependents, ${sameValue ? 'same value, kept' : 'new value, recalculated'}`;

    return bench(
      name,
      {
        beforeAll: () => {
          updates.set(name, createFanOutSetup(dependentCount));
        },
      },
      () => updates.get(name)!(sameValue ? 20 : ++next),
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
 * Measures a first pass of a new evaluator over new data, including creating the data.
 *
 * NOTE: warmupIterations here prewarms V8's JIT compiler for the CODE PATHS,
 * not the DATA. Each iteration creates a fresh evaluator and fresh formulas.
 * This simulates "app is warm, but user opens new document with 1000 formulas".
 */
it('Warm Code, Cold Data (new document)', async ({ bench }) => {
  // Seeded random for reproducible benchmarks
  const seededRandom = (seed: number) => {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;

      return seed / 233280;
    };
  };

  const runColdStart = (formulaCount: number, baseCount: number): void => {
    const random = seededRandom(42);
    const data: Record<string, number | Formula> = {};

    for (let i = 0; i < baseCount; i++) {
      data[`p${i}`] = i;
    }

    for (let i = 0; i < formulaCount; i++) {
      const numDeps = Math.floor(random() * 3) + 1;
      const deps = [];

      for (let j = 0; j < numDeps; j++) {
        deps.push(`p${Math.floor(random() * baseCount)}`);
      }

      data[`f${i}`] = new Formula(deps.join(' + '));
    }

    scope.evaluator().evaluate(data);
  };

  await bench.compare(
    bench('100 formulas (10 bases)', () => runColdStart(100, 10)),
    bench('500 formulas (50 bases)', () => runColdStart(500, 50)),
    bench('1000 formulas (100 bases)', () => runColdStart(1000, 100)),
    // warmup prewarms JIT for code paths, data is fresh each time
    { warmupIterations: 3, iterations: 20 },
  );
});

/**
 * Benchmark: Formula complexity
 * Measures recalculation time for formulas with different numbers of inputs when a shared input changes,
 * and what a pass costs when nothing changed
 */
it('Formula Complexity (same formula count)', async ({ bench }) => {
  const runs = new Map<string, () => void>();
  let next = 0;

  const createComplexitySetup = (depsPerFormula: number): { recalculate: () => void; again: () => void } => {
    const evaluator = scope.evaluator();
    const data: Record<string, number | Formula> = {};

    for (let i = 0; i < 10; i++) {
      data[`base${i}`] = i + 1;
    }

    for (let i = 0; i < 50; i++) {
      const deps = [];

      for (let j = 0; j < depsPerFormula; j++) {
        deps.push(`base${j % 10}`);
      }

      data[`f${i}`] = new Formula(deps.join(' + '));
    }

    evaluator.evaluate(data);

    return {
      // Every formula reads base0, so changing it recalculates all 50
      recalculate: () => {
        data.base0 = ++next;
        evaluator.evaluate(data);
      },
      again: () => evaluator.evaluate(data),
    };
  };

  const complexityBench = (depsPerFormula: number, inputChanged: boolean) => {
    const name = `50 formulas, ${depsPerFormula} inputs each, ${inputChanged ? 'input changed, recalculated' : 'nothing changed, kept'}`;

    return bench(
      name,
      {
        beforeAll: () => {
          const { recalculate, again } = createComplexitySetup(depsPerFormula);

          runs.set(name, inputChanged ? recalculate : again);
        },
      },
      () => runs.get(name)!(),
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

/**
 * Benchmark: Large data
 * Measures a pass over 100,000 records with two formulas each, after one edit and with nothing changed:
 * the walk of all of the data and the check of every cell, which bound what `evaluateAsync` holds the main thread
 */
it('Large Data (100,000 records)', async ({ bench }) => {
  const evaluator = scope.evaluator();
  const records = Array.from({ length: 100_000 }, (_, index) => ({
    price: index % 97,
    quantity: (index % 7) + 1,
    cost: index % 13,
    rate: 1.2,
    total: new Formula('price * quantity'),
    margin: new Formula('cost * rate'),
  }));
  const data = { records };
  let next = 0;

  evaluator.evaluate(data);

  await bench.compare(
    bench('one edit, recalculated', () => {
      records[next++ % records.length].price += 1;
      evaluator.evaluate(data);
    }),
    bench('nothing changed, kept', () => {
      evaluator.evaluate(data);
    }),
    { warmupIterations: 3, iterations: 20 },
  );
});
