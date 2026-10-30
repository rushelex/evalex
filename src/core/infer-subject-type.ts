import type { AST } from '../parser';
import type { FormulaType } from './types';

import { TypeInferenceVisitor } from './type-inference.visitor';
import { type, unionOf } from './types';

interface InferSubjectTypeOptions {
  /** The parsed formula. */
  readonly formula: AST.AstNode;
  /** The types of the names the formula reads from its record; a name left out holds any value. */
  readonly fields: ReadonlyMap<string, FormulaType>;
  /** The method name of a call inside `formula`, the node itself rather than an equal one. */
  readonly method: AST.IIdentifierNode;
}

/**
 * The type of the value a method call inside a formula is called on, with the names in scope where it stands, such as
 * `current` inside `filter`.
 *
 * @returns The union over every scope the call is read in, such as each argument list of a routine around it; `Any`
 * when the formula does not read the call.
 */
export function inferSubjectType({ formula, fields, method }: InferSubjectTypeOptions): FormulaType {
  const subjects: FormulaType[] = [];

  new TypeInferenceVisitor({ fields, probe: { method, subjects } }).typeOf(formula);

  return subjects.length > 0 ? unionOf(subjects) : type.any;
}
