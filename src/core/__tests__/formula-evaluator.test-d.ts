import type { SyntaxError } from '../../parser/grammar/parser';
import type { FormulaValue } from '../data-types';
import type { FormulaError } from '../errors';
import type { Formula } from '../formula';
import type { FormulaEvaluator } from '../formula-evaluator';

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
});
