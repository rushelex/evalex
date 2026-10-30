import type { AST } from '../parser';
import type { FormulaError } from './errors';
import type { FormulaType } from './types';

import { TypeInferenceVisitor } from './type-inference.visitor';

interface CheckFormulaOptions {
  /** The parsed formula. */
  readonly formula: AST.AstNode;
  /**
   * Every name the formula can read from its record, with the type of its values; a name outside it is an error.
   * Without it, any name may be read and holds any value.
   */
  readonly fields?: ReadonlyMap<string, FormulaType>;
}

/**
 * The errors evaluation raises on every record whose fields have the types of `fields`, whenever it reaches the part
 * of the formula they point at: unknown names, functions and methods, fields a record does not have, and arguments a
 * routine does not take.
 *
 * @remarks
 * A part evaluation may skip, such as a branch of `? :` or an expression evaluated per item, is checked as if it were
 * reached. An error that depends on the values rather than on their types, such as a read of an empty value, is left
 * out.
 *
 * @returns The errors in the order of the formula text, each once.
 */
export function checkFormula({ formula, fields }: CheckFormulaOptions): FormulaError[] {
  const errors: FormulaError[] = [];

  new TypeInferenceVisitor({ fields: fields ?? new Map(), errors, closedNames: fields !== undefined }).typeOf(formula);

  const unique = new Map(errors.map((error) => [`${error.messageKey} ${error.location?.start.offset} ${error.location?.end.offset}`, error]));

  return [...unique.values()].toSorted((left, right) => (left.location?.start.offset ?? 0) - (right.location?.start.offset ?? 0));
}
