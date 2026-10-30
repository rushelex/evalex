import type { AST } from '../parser';
import type { FormulaType } from './types';

import { TypeInferenceVisitor } from './type-inference.visitor';

interface InferTypeOptions {
  /** The parsed formula. */
  readonly formula: AST.AstNode;
  /** The types of the names the formula reads from its record; a name left out holds any value. */
  readonly fields: ReadonlyMap<string, FormulaType>;
}

/**
 * The type of what a formula evaluates to on any record whose fields have the types of `fields`.
 *
 * @remarks
 * The type never leaves out a value the evaluation can give, so it errs wider where the formula alone does not
 * tell: a name the record has no type for, a routine that reads its arguments itself, such as `if`, and a field read
 * of a record of unknown fields hold any value. An expression that always fails, such as `"a" * 2`, may be given any
 * type.
 */
export function inferType({ formula, fields }: InferTypeOptions): FormulaType {
  return new TypeInferenceVisitor({ fields }).typeOf(formula);
}
