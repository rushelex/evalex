/**
 * Marks a cell of host data as a formula, so an evaluator computes the cell instead of reading it as a value.
 *
 * @remarks
 * It only carries the text: it evaluates nothing itself and needs no scope. The text is checked when an evaluator
 * computes the cell, which then holds the syntax error of a text that does not parse.
 *
 * @example
 * ```ts
 * const form = { area: 42, pricePerMeter: 1000, cost: new Formula('area * pricePerMeter') };
 *
 * scope.evaluator().evaluate(form).cost.value; // 42000
 * ```
 */
export class Formula {
  readonly text: string;

  constructor(text: string) {
    this.text = text;
    Object.freeze(this);
  }
}
