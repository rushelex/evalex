import type { AST } from '../parser';
import type { GlobalProperties } from './context';
import type { FormulaDataType } from './data-types';
import type { ValueFormat } from './value-format';

import { FormulaEvaluationContext } from './context';
import { FormulaEvaluatorVisitor } from './evaluator.visitor';

/**
 * Evaluates a parsed formula over values found by name, the step `FormulaScope` and an evaluation pass share.
 * The format and the time zone are expected to be validated by the caller, once per scope rather than once per evaluation.
 *
 * @throws FormulaError when the formula fails.
 */
export function evaluateFormula({ formula, ast, properties, format, timeZone }: {
  formula: string;
  ast: AST.AstNode;
  properties: GlobalProperties;
  format: ValueFormat | undefined;
  timeZone: string;
}): FormulaDataType {
  const visitor = new FormulaEvaluatorVisitor(formula, new FormulaEvaluationContext(properties), { format, timeZone });

  return visitor.evaluateNode(ast);
}
