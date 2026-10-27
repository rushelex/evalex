/* eslint-disable test/prefer-lowercase-title */
import type { FormulaEvaluator } from 'evalex';

import { Formula, FormulaNumber, FormulaScope } from 'evalex';
import { HyperFormula } from 'hyperformula';
import { it } from 'vitest';

/**
 * Profiling benchmark to identify the actual bottleneck in recalculation.
 */

const scope = new FormulaScope();

/**
 * Test 1: Raw formula evaluation (no evaluator overhead)
 */
it('Profile: Raw scope.evaluate()', async ({ bench }) => {
  // Local binding skips the module runner's export getter in the measured loop
  const NumberCtor = FormulaNumber;
  let next = 30;

  await bench.compare(
    bench('scope.evaluate() with a plain number', () => {
      scope.evaluate('A1 * 2', { A1: 20 });
    }),
    bench('scope.evaluate() with a new formula value', () => {
      scope.evaluate('A1 * 2', { A1: new NumberCtor(++next) });
    }),
    { warmupIterations: 100, iterations: 1000 },
  );
});

/**
 * Test 2: Evalex evaluator recalculation
 */
it('Profile: Evalex evaluator recalculation', async ({ bench }) => {
  let evaluator: FormulaEvaluator;
  let data: { A1: number; B1: Formula };
  let next = 20;

  const createSetup = (): void => {
    evaluator = scope.evaluator();
    data = { A1: 10, B1: new Formula('A1 * 2') };
    evaluator.evaluate(data);
  };

  const update = (value: number): void => {
    data.A1 = value;
    evaluator.evaluate(data);
  };

  await bench.compare(
    bench('evaluate, new value, recalculated', { beforeAll: createSetup }, () => update(++next)),
    bench('evaluate, same value, kept', { beforeAll: createSetup }, () => update(20)),
    { warmupIterations: 10, iterations: 100 },
  );
});

/**
 * Test 3: HyperFormula for comparison
 */
it('Profile: HyperFormula recalculation', async ({ bench }) => {
  let hf: HyperFormula;
  let next = 30;

  const createSetup = () => {
    hf = HyperFormula.buildFromArray(
      [[10, '=A1*2']],
      { licenseKey: 'gpl-v3' },
    );
  };

  await bench.compare(
    bench('hf.setCellContents (1 dependent), new value', { beforeAll: createSetup }, () => {
      hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[++next]]);
    }),
    bench('hf.setCellContents (1 dependent), same value', { beforeAll: createSetup }, () => {
      hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[30]]);
    }),
    { warmupIterations: 10, iterations: 100 },
  );
});

/**
 * Test 4: Breakdown - what does the evaluator do?
 */
it('Profile: Evaluator breakdown (50 dependents)', async ({ bench }) => {
  let evaluator: FormulaEvaluator;
  let data: Record<string, number | Formula>;
  let hf: HyperFormula;
  let next = 30;

  const createEvalexSetup = (): void => {
    evaluator = scope.evaluator();
    data = { A1: 10 };

    for (let i = 0; i < 50; i++) {
      data[`B${i + 1}`] = new Formula(`A1 * ${i + 1}`);
    }

    evaluator.evaluate(data);
  };

  const updateEvalex = (value: number): void => {
    data.A1 = value;
    evaluator.evaluate(data);
  };

  const createHyperFormulaSetup = () => {
    const sheet: (number | string)[][] = [[10]];

    for (let i = 0; i < 50; i++) {
      sheet.push([`=A1*${i + 1}`]);
    }

    hf = HyperFormula.buildFromArray(sheet, { licenseKey: 'gpl-v3' });
  };

  const updateHyperFormula = (value: number) => {
    hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[value]]);

    // Force actual evaluation of all dependents
    for (let i = 0; i < 50; i++) {
      hf.getCellValue({ sheet: 0, col: 0, row: i + 1 });
    }
  };

  await bench.compare(
    bench('evalex: 50 dependents, new value', { beforeAll: createEvalexSetup }, () => updateEvalex(++next)),
    bench('evalex: 50 dependents, same value, kept', { beforeAll: createEvalexSetup }, () => updateEvalex(20)),
    bench('HyperFormula: 50 dependents, new value (set only - lazy)', { beforeAll: createHyperFormulaSetup }, () => {
      hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[++next]]);
    }),
    bench('HyperFormula: 50 dependents, new value (set + get all)', { beforeAll: createHyperFormulaSetup }, () => {
      updateHyperFormula(++next);
    }),
    bench('HyperFormula: 50 dependents, same value (set + get all)', { beforeAll: createHyperFormulaSetup }, () => {
      updateHyperFormula(30);
    }),
    bench('raw: 50x scope.evaluate()', () => {
      for (let i = 0; i < 50; i++) {
        scope.evaluate(`A1 * ${i + 1}`, { A1: 20 });
      }
    }),
    { warmupIterations: 5, iterations: 50 },
  );
});
