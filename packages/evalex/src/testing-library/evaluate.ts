import type { FormulaDataType, ValueFormat } from '../core';

import { FormulaScope } from '../core';

export interface EvaluateOptions {
  readonly context?: Readonly<Record<string, FormulaDataType>> | ReadonlyMap<string, FormulaDataType>;
  /** How values look when the formula turns them into text. */
  readonly format?: ValueFormat;
}

const plainScope = new FormulaScope();

/** Evaluates a formula over formula values found by name, the way a host evaluates it with `scope.evaluate`. */
export function evaluate(formula: string, { context = {}, format }: EvaluateOptions = {}): FormulaDataType {
  const scope = format ? new FormulaScope({ format }) : plainScope;

  return scope.evaluate(formula, context instanceof Map ? Object.fromEntries(context) : context);
}
