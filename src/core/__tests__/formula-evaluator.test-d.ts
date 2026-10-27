import type { SyntaxError } from '../../parser/grammar/parser';
import type { FormulaValue } from '../data-types';
import type { FormulaError } from '../errors';
import type { Formula } from '../formula';
import type { FormulaCell, FormulaEvaluator } from '../formula-evaluator';

declare const evaluator: FormulaEvaluator;

describe('FormulaEvaluator view', () => {
  it('should type a formula cell as what it holds once computed and keep the types of other fields', () => {
    interface Line {
      readonly qty: number;
      readonly cost: Formula;
      readonly due: Date;
    }

    interface Order {
      readonly title: string;
      readonly lines: readonly Line[];
      readonly total: Formula | number;
    }

    const view = evaluator.evaluate<Order>({} as Order);
    const [line] = view.lines;

    expectTypeOf(view.title).toEqualTypeOf<string>();
    expectTypeOf(line.qty).toEqualTypeOf<number>();
    expectTypeOf(line.cost).toEqualTypeOf<FormulaValue | FormulaError | SyntaxError>();
    expectTypeOf(line.due.getTime()).toEqualTypeOf<number>();
    expectTypeOf(view.total).toEqualTypeOf<FormulaValue | FormulaError | SyntaxError | number>();
  });

  it('should type the view of data without a type argument from the data', () => {
    const view = evaluator.evaluate({ qty: 2, cost: {} as Formula });

    expectTypeOf(view).toEqualTypeOf<{ qty: number; cost: FormulaValue | FormulaError | SyntaxError }>();
  });

  it('should type the view of data read through the cell option as the view the host names', () => {
    interface BackendCell {
      readonly value: number | string;
      readonly isFormula: boolean;
    }

    interface ReportView {
      readonly rows: ReadonlyArray<Readonly<Record<string, FormulaCell | number | string>>>;
    }

    const report: { rows: Array<Record<string, BackendCell>> } = { rows: [] };

    expectTypeOf(evaluator.evaluate<ReportView>(report)).toEqualTypeOf<ReportView>();
    expectTypeOf(evaluator.evaluateAsync<ReportView>(report)).toEqualTypeOf<Promise<ReportView>>();
  });

  it('should type the view evaluateAsync resolves with as the view evaluate gives', () => {
    expectTypeOf(evaluator.evaluateAsync({ qty: 2, cost: {} as Formula })).toEqualTypeOf<Promise<{ qty: number; cost: FormulaValue | FormulaError | SyntaxError }>>();
  });
});
