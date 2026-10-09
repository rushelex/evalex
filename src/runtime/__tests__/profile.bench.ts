/* eslint-disable test/prefer-lowercase-title */

import type { FormulaDataType, NodeAdapter } from 'evalex';

import {
  Expression,
  FormulaNull,
  FormulaNumber,
  FormulaRuntime,
  ImmediateScheduler,
  SyncExecutor,
} from 'evalex';
import { HyperFormula } from 'hyperformula';
import { it } from 'vitest';

interface Node {
  id: string;
  value: FormulaDataType;
  expression?: Expression;
  activeDeps?: Set<string>;
}

/**
 * Profiling benchmark to identify the actual bottleneck in recalculation.
 */

/**
 * Test 1: Raw expression evaluation (no runtime overhead)
 */
it('Profile: Raw Expression.evaluate()', async ({ bench }) => {
  let expression: Expression;
  let context: Map<string, FormulaDataType>;

  // Local binding skips the module runner's export getter in the measured loop
  const NumberCtor = FormulaNumber;

  await bench.compare(
    bench(
      'expression.evaluate() only',
      {
        beforeAll: () => {
          expression = new Expression('A1 * 2');
          context = new Map([['A1', new FormulaNumber(20)]]);
        },
      },
      () => {
        expression.evaluate({ context });
      },
    ),
    bench(
      'expression.evaluate() with context update',
      {
        beforeAll: () => {
          expression = new Expression('A1 * 2');
          context = new Map([['A1', new FormulaNumber(10)]]);
        },
      },
      () => {
        context.set('A1', new NumberCtor(30));
        expression.evaluate({ context });
      },
    ),
    { warmupIterations: 100, iterations: 1000 },
  );
});

/**
 * Test 2: Evalex Runtime recalculation
 */
it('Profile: Evalex Runtime recalculation', async ({ bench }) => {
  let runtime: FormulaRuntime<Node>;
  let registry: Map<string, Node>;

  await bench(
    'runtime.enqueueDependents + waitForProcessing',
    {
      beforeAll: async () => {
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
          },
        };

        registry = new Map<string, Node>();
        registry.set('A1', { id: 'A1', value: new FormulaNumber(10) });
        registry.set('B1', {
          id: 'B1',
          value: new FormulaNumber(0),
          expression: new Expression('A1 * 2'),
        });

        runtime = new FormulaRuntime<Node>({
          executor: new SyncExecutor(),
          scheduler: new ImmediateScheduler(),
          adapter,
          nodeProvider: (id) => registry.get(id),
        });

        // Initial calculation
        runtime.enqueue('B1');
        await runtime.waitForProcessing();
      },
    },
    async () => {
      registry.get('A1')!.value = new FormulaNumber(20);
      runtime.enqueueDependents('A1');
      await runtime.waitForProcessing();
    },
  ).run({ warmupIterations: 10, iterations: 100 });
});

/**
 * Test 3: HyperFormula for comparison
 */
it('Profile: HyperFormula recalculation', async ({ bench }) => {
  let hf: HyperFormula;

  await bench(
    'hf.setCellContents (1 dependent)',
    {
      beforeAll: () => {
        hf = HyperFormula.buildFromArray(
          [[10, '=A1*2']],
          { licenseKey: 'gpl-v3' },
        );
      },
    },
    () => {
      hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[30]]);
    },
  ).run({ warmupIterations: 10, iterations: 100 });
});

/**
 * Test 4: Breakdown - what does runtime do?
 */
it('Profile: Runtime breakdown (50 dependents)', async ({ bench }) => {
  let runtime: FormulaRuntime<Node>;
  let registry: Map<string, Node>;
  let hf: HyperFormula;

  // Variables for setup
  let expressions: Expression[] = [];
  let context: Map<string, FormulaDataType>;

  await bench.compare(
    bench(
      'evalex: 50 dependents',
      {
        beforeAll: async () => {
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
            },
          };

          registry = new Map<string, Node>();
          registry.set('A1', { id: 'A1', value: new FormulaNumber(10) });
          for (let i = 0; i < 50; i++) {
            registry.set(`B${i + 1}`, {
              id: `B${i + 1}`,
              value: new FormulaNumber(0),
              expression: new Expression(`A1 * ${i + 1}`),
            });
          }

          runtime = new FormulaRuntime<Node>({
            executor: new SyncExecutor(),
            scheduler: new ImmediateScheduler(),
            adapter,
            nodeProvider: (id) => registry.get(id),
          });

          // Initial calculation
          for (let i = 0; i < 50; i++) {
            runtime.enqueue(`B${i + 1}`);
          }
          await runtime.waitForProcessing();
        },
      },
      async () => {
        registry.get('A1')!.value = new FormulaNumber(20);
        runtime.enqueueDependents('A1');
        await runtime.waitForProcessing();
      },
    ),
    bench(
      'HyperFormula: 50 dependents (set only - lazy)',
      {
        beforeAll: () => {
          const data: (number | string)[][] = [[10]];
          for (let i = 0; i < 50; i++) {
            data.push([`=A1*${i + 1}`]);
          }
          hf = HyperFormula.buildFromArray(data, { licenseKey: 'gpl-v3' });
        },
      },
      () => {
        hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[30]]);
      },
    ),
    bench(
      'HyperFormula: 50 dependents (set + get all)',
      {
        beforeAll: () => {
          const data: (number | string)[][] = [[10]];
          for (let i = 0; i < 50; i++) {
            data.push([`=A1*${i + 1}`]);
          }
          hf = HyperFormula.buildFromArray(data, { licenseKey: 'gpl-v3' });
        },
      },
      () => {
        hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[30]]);
        // Force actual evaluation of all dependents
        for (let i = 0; i < 50; i++) {
          hf.getCellValue({ sheet: 0, col: 0, row: i + 1 });
        }
      },
    ),
    bench(
      'raw: 50x expression.evaluate()',
      {
        beforeAll: () => {
          expressions = [];
          for (let i = 0; i < 50; i++) {
            expressions.push(new Expression(`A1 * ${i + 1}`));
          }
          context = new Map([['A1', new FormulaNumber(20)]]);
        },
      },
      () => {
        for (let i = 0; i < 50; i++) {
          expressions[i].evaluate({ context });
        }
      },
    ),
    { warmupIterations: 5, iterations: 50 },
  );
});
