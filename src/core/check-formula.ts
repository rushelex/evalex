import type { FormulaError } from './errors';
import type { FormulaType } from './types';

import { FormulaEvaluationContext } from './context';
import { FormulaEvaluatorVisitor } from './evaluator.visitor';
import { parseFormula } from './parse-formula';
import { TypeInferenceVisitor } from './type-inference.visitor';

interface CheckFormulaOptions {
  /** Formula text that parses. */
  readonly text: string;
  /**
   * Every name the formula can read from its record, with the type of its values; a name outside it is an error.
   * Without it, any name may be read and holds any value.
   */
  readonly fields?: ReadonlyMap<string, FormulaType>;
}

/**
 * The errors evaluation raises on every record whose fields have the types of `fields`, whenever it reaches the part
 * of the formula they point at: unknown names, functions and methods, fields a record does not have, arguments a
 * routine does not take and operands an operator does not take.
 *
 * @remarks
 * A part evaluation may skip, such as a branch of `? :` or an expression evaluated per item, is checked as if it were
 * reached. An error that depends on the values rather than on their types, such as a read of an empty value or a
 * division by zero, is left out.
 *
 * @returns The errors in the order of the formula text, each once.
 */
export function checkFormula({ text, fields }: CheckFormulaOptions): FormulaError[] {
  const errors: FormulaError[] = [];
  const checker = new FormulaEvaluatorVisitor(text, new FormulaEvaluationContext(new Map()));

  new TypeInferenceVisitor({ fields: fields ?? new Map(), errors, closedNames: fields !== undefined, checker }).typeOf(parseFormula(text));

  const unique = new Map(errors.map((error) => [`${error.messageKey} ${error.location?.start.offset} ${error.location?.end.offset}`, error]));

  return [...unique.values()].toSorted((left, right) => (left.location?.start.offset ?? 0) - (right.location?.start.offset ?? 0));
}
