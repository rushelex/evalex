/* eslint-disable test/prefer-lowercase-title */

import type { FormulaDataType } from '../../core';
import type { NodeAdapter } from '../types';

import { HyperFormula } from 'hyperformula';
import { bench, describe } from 'vitest';

import { Expression, FormulaEvaluationContext, FormulaNull, FormulaNumber } from '../../core';
import { FormulaEvaluatorVisitor } from '../../core/evaluator.visitor';
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
 * Profiling benchmark to identify the actual bottleneck in recalculation.
 */

/**
 * Test 1: Raw expression evaluation (no runtime overhead)
 */
describe('Profile: Raw Expression.evaluate()', () => {
  let expression: Expression;
  let context: Map<string, FormulaDataType>;

  bench(
    'expression.evaluate() only',
    () => {
      expression.evaluate({ context });
    },
    {
      warmupIterations: 100,
      iterations: 1000,
      setup: () => {
        expression = new Expression('A1 * 2');
        context = new Map([['A1', new FormulaNumber(20)]]);
      },
    },
  );

  bench(
    'expression.evaluate() with context update',
    () => {
      context.set('A1', new FormulaNumber(30));
      expression.evaluate({ context });
    },
    {
      warmupIterations: 100,
      iterations: 1000,
      setup: () => {
        expression = new Expression('A1 * 2');
        context = new Map([['A1', new FormulaNumber(10)]]);
      },
    },
  );
});

/**
 * Test 2: Raw visitor evaluation (even lower level)
 */
describe('Profile: Raw Visitor evaluation', () => {
  let expression: Expression;
  let ctx: FormulaEvaluationContext;
  let visitor: FormulaEvaluatorVisitor;
  let ast: ReturnType<Expression['parse']>;

  bench(
    'visitor.evaluateNode() only',
    () => {
      visitor.evaluateNode(ast);
    },
    {
      warmupIterations: 100,
      iterations: 1000,
      setup: () => {
        expression = new Expression('A1 * 2');
        ast = expression.parse();
        const props = new Map([['A1', new FormulaNumber(20) as FormulaDataType]]);
        ctx = new FormulaEvaluationContext(props);
        visitor = new FormulaEvaluatorVisitor(expression.formula, ctx);
      },
    },
  );
});

/**
 * Test 3: Evalex Runtime recalculation
 */
describe('Profile: Evalex Runtime recalculation', () => {
  let runtime: FormulaRuntime<Node>;
  let registry: Map<string, Node>;

  bench(
    'runtime.enqueueDependents + waitForProcessing',
    async () => {
      registry.get('A1')!.value = new FormulaNumber(20);
      runtime.enqueueDependents('A1');
      await runtime.waitForProcessing();
    },
    {
      warmupIterations: 10,
      iterations: 100,
      setup: async () => {
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
  );
});

/**
 * Test 4: HyperFormula for comparison
 */
describe('Profile: HyperFormula recalculation', () => {
  let hf: HyperFormula;

  bench(
    'hf.setCellContents (1 dependent)',
    () => {
      hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[30]]);
    },
    {
      warmupIterations: 10,
      iterations: 100,
      setup: () => {
        hf = HyperFormula.buildFromArray(
          [[10, '=A1*2']],
          { licenseKey: 'gpl-v3' },
        );
      },
    },
  );
});

/**
 * Test 5: Breakdown - what does runtime do?
 */
describe('Profile: Runtime breakdown (50 dependents)', () => {
  let runtime: FormulaRuntime<Node>;
  let registry: Map<string, Node>;
  let hf: HyperFormula;

  // Variables for setup
  let expressions: Expression[] = [];
  let context: Map<string, FormulaDataType>;

  bench(
    'evalex: 50 dependents',
    async () => {
      registry.get('A1')!.value = new FormulaNumber(20);
      runtime.enqueueDependents('A1');
      await runtime.waitForProcessing();
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: async () => {
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
  );

  bench(
    'HyperFormula: 50 dependents (set only - lazy)',
    () => {
      hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[30]]);
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: () => {
        const data: (number | string)[][] = [[10]];
        for (let i = 0; i < 50; i++) {
          data.push([`=A1*${i + 1}`]);
        }
        hf = HyperFormula.buildFromArray(data, { licenseKey: 'gpl-v3' });
      },
    },
  );

  bench(
    'HyperFormula: 50 dependents (set + get all)',
    () => {
      hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[30]]);
      // Force actual evaluation of all dependents
      for (let i = 0; i < 50; i++) {
        hf.getCellValue({ sheet: 0, col: 0, row: i + 1 });
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
        hf = HyperFormula.buildFromArray(data, { licenseKey: 'gpl-v3' });
      },
    },
  );

  bench(
    'raw: 50x expression.evaluate()',
    () => {
      for (let i = 0; i < 50; i++) {
        expressions[i].evaluate({ context });
      }
    },
    {
      warmupIterations: 5,
      iterations: 50,
      setup: () => {
        expressions = [];
        for (let i = 0; i < 50; i++) {
          expressions.push(new Expression(`A1 * ${i + 1}`));
        }
        context = new Map([['A1', new FormulaNumber(20)]]);
      },
    },
  );
});
