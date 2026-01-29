/* eslint-disable test/prefer-lowercase-title */
import type { FormulaDataType } from '../../core';
import type { FormulaRuntimeOptions } from '../runtime';
import type { NodeAdapter } from '../types';

import { HyperFormula } from 'hyperformula';
import { bench, describe } from 'vitest';

import { Expression, FormulaNull, FormulaNumber } from '../../core';
import { SyncExecutor } from '../executor';
import { FormulaRuntime } from '../runtime';
import { ImmediateScheduler } from '../scheduler';

interface Node {
  id: string;
  value: FormulaDataType;
  expression?: Expression;
  activeDeps?: Set<string>;
}

/**
 * Head-to-head comparison benchmark: evalex vs HyperFormula
 *
 * Tests the same scenarios in both systems to enable direct comparison.
 */

/**
 * Scenario 1: Simple formula A + B
 */
describe('Comparison: Simple Formula (A + B)', () => {
  let evalexInitFn: () => Promise<void>;
  let hfInstance: HyperFormula;

  bench(
    'evalex',
    async () => {
      await evalexInitFn();
    },
    {
      warmupIterations: 10,
      iterations: 100,
      setup: () => {
        const { registry, initializeFormulas } = setupEvalex();
        registry.set('A1', { id: 'A1', value: new FormulaNumber(10) });
        registry.set('B1', { id: 'B1', value: new FormulaNumber(20) });
        registry.set('C1', {
          id: 'C1',
          value: new FormulaNumber(0),
          expression: new Expression('A1 + B1'),
        });
        evalexInitFn = initializeFormulas;
      },
    },
  );

  bench(
    'HyperFormula',
    () => {
      // HyperFormula calculates on build
      hfInstance = HyperFormula.buildFromArray(
        [
          [10, 20, '=A1+B1'],
        ],
        { licenseKey: 'gpl-v3' },
      );
      hfInstance.getCellValue({ sheet: 0, col: 2, row: 0 });
    },
    { warmupIterations: 10, iterations: 100 },
  );
});

/**
 * Scenario 2: Chain of formulas (sequential dependency)
 */
describe('Comparison: Chain of 10 formulas', () => {
  let evalexInitFn: () => Promise<void>;

  bench(
    'evalex',
    async () => {
      await evalexInitFn();
    },
    {
      warmupIterations: 10,
      iterations: 100,
      setup: () => {
        const { registry, initializeFormulas } = setupEvalex();
        registry.set('A1', { id: 'A1', value: new FormulaNumber(1) });
        for (let i = 2; i <= 11; i++) {
          const prevCol = String.fromCharCode(64 + i - 1); // A, B, C...
          const col = String.fromCharCode(64 + i);
          registry.set(`${col}1`, {
            id: `${col}1}`,
            value: new FormulaNumber(0),
            expression: new Expression(`${prevCol}1 + 1`),
          });
        }
        evalexInitFn = initializeFormulas;
      },
    },
  );

  bench(
    'HyperFormula',
    () => {
      const row = [1];
      for (let i = 1; i <= 10; i++) {
        const prevCol = String.fromCharCode(64 + i); // A, B, C...
        row.push(`=${prevCol}1+1` as unknown as number);
      }
      const hf = HyperFormula.buildFromArray([row], { licenseKey: 'gpl-v3' });
      hf.getCellValue({ sheet: 0, col: 10, row: 0 });
    },
    { warmupIterations: 10, iterations: 100 },
  );
});

/**
 * Scenario 3: Fan-out (one cell affects many)
 */
describe('Comparison: 50 formulas depending on one cell', () => {
  let evalexInitFn: () => Promise<void>;

  bench(
    'evalex',
    async () => {
      await evalexInitFn();
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: () => {
        const { registry, initializeFormulas } = setupEvalex();
        registry.set('A1', { id: 'A1', value: new FormulaNumber(10) });
        for (let i = 0; i < 50; i++) {
          registry.set(`B${i + 1}`, {
            id: `B${i + 1}`,
            value: new FormulaNumber(0),
            expression: new Expression(`A1 * ${i + 1}`),
          });
        }
        evalexInitFn = initializeFormulas;
      },
    },
  );

  bench(
    'HyperFormula',
    () => {
      const data: (number | string)[][] = [[10]];
      for (let i = 0; i < 50; i++) {
        data.push([`=A1*${i + 1}`]);
      }
      const hf = HyperFormula.buildFromArray(data, { licenseKey: 'gpl-v3' });
      hf.getCellValue({ sheet: 0, col: 0, row: 50 });
    },
    { warmupIterations: 5, iterations: 50 },
  );
});

/**
 * Scenario 4: Large sheet initialization (1000 formulas)
 * This is the HyperFormula-style benchmark for "cold start"
 */
describe('Comparison: 1000 formulas initialization', () => {
  // Seeded random for reproducibility
  const seededRandom = (seed: number) => {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  };

  bench(
    'evalex',
    async () => {
      const random = seededRandom(42);
      const { registry, initializeFormulas } = setupEvalex();

      // 100 base values
      for (let i = 0; i < 100; i++) {
        registry.set(`P${i}`, { id: `P${i}`, value: new FormulaNumber(i) });
      }

      // 1000 formulas
      for (let i = 0; i < 1000; i++) {
        const numDeps = Math.floor(random() * 3) + 1;
        const deps = [];
        for (let j = 0; j < numDeps; j++) {
          deps.push(`P${Math.floor(random() * 100)}`);
        }
        registry.set(`F${i}`, {
          id: `F${i}`,
          value: new FormulaNumber(0),
          expression: new Expression(deps.join(' + ')),
        });
      }

      await initializeFormulas();
    },
    { warmupIterations: 3, iterations: 20 },
  );

  bench(
    'HyperFormula',
    () => {
      const random = seededRandom(42);

      // Build data array
      const data: (number | string)[][] = [];

      // 100 base values in first column
      for (let i = 0; i < 100; i++) {
        data.push([i]);
      }

      // 1000 formulas in second column
      for (let i = 0; i < 1000; i++) {
        const numDeps = Math.floor(random() * 3) + 1;
        const deps = [];
        for (let j = 0; j < numDeps; j++) {
          const row = Math.floor(random() * 100) + 1;
          deps.push(`A${row}`);
        }
        if (data[i]) {
          data[i].push(deps.join('+'));
        }
        else {
          data.push(['', `=${deps.join('+')}`]);
        }
      }

      const hf = HyperFormula.buildFromArray(data, { licenseKey: 'gpl-v3' });
      // Trigger calculation
      hf.getCellValue({ sheet: 0, col: 1, row: 999 });
    },
    { warmupIterations: 3, iterations: 20 },
  );
});

/**
 * Scenario 5: Recalculation after value change (UPDATE scenario)
 * This is crucial for real-time editing like Notion
 */
describe('Comparison: Recalculation after value change (50 dependents)', () => {
  let evalexUpdateFn: () => Promise<void>;
  let hfInstance: HyperFormula;

  bench(
    'evalex',
    async () => {
      await evalexUpdateFn();
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: async () => {
        const { registry, runtime, initializeFormulas } = setupEvalex();
        registry.set('A1', { id: 'A1', value: new FormulaNumber(10) });
        for (let i = 0; i < 50; i++) {
          registry.set(`B${i + 1}`, {
            id: `B${i + 1}`,
            value: new FormulaNumber(0),
            expression: new Expression(`A1 * ${i + 1}`),
          });
        }
        await initializeFormulas();

        evalexUpdateFn = async () => {
          registry.get('A1')!.value = new FormulaNumber(20);
          runtime.enqueueDependents('A1');
          await runtime.waitForProcessing();
        };
      },
    },
  );

  bench(
    'HyperFormula',
    () => {
      hfInstance.setCellContents({ sheet: 0, col: 0, row: 0 }, [[30]]);
      // Force actual evaluation (HyperFormula is lazy)
      for (let i = 0; i < 50; i++) {
        hfInstance.getCellValue({ sheet: 0, col: 0, row: i + 1 });
      }
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: () => {
        const data: (number | string)[][] = [[10]];
        for (let i = 0; i < 50; i++) {
          data.push([`=A1*${i + 1}`]);
        }
        hfInstance = HyperFormula.buildFromArray(data, { licenseKey: 'gpl-v3' });
      },
    },
  );
});

// Helper function for evalex setup
function setupEvalex(options?: Partial<FormulaRuntimeOptions<Node>>) {
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
