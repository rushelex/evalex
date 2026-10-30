import type { AST } from '../parser';
import type { FormulaType } from './types';

import { TypeInferenceVisitor } from './type-inference.visitor';
import { type, unionOf } from './types';

interface InferNodeTypeOptions {
  /** The parsed formula. */
  readonly formula: AST.AstNode;
  /** The types of the names the formula reads from its record; a name left out holds any value. */
  readonly fields: ReadonlyMap<string, FormulaType>;
  /** A node inside `formula`, the node itself rather than an equal one. */
  readonly node: AST.AstNode;
}

/**
 * The type of a node inside a formula, with the names in scope where it stands, such as `current` inside `filter`.
 *
 * @returns The union over every scope the node is read in, such as each argument list of a routine around it, or `Any`
 * when the formula does not read the node; for a name, also whether a scope it is read in declares it.
 */
export function inferNodeType({ formula, fields, node }: InferNodeTypeOptions): { readonly type: FormulaType; readonly declared: boolean } {
  const types: FormulaType[] = [];
  const probe = { node, types, declared: false };

  new TypeInferenceVisitor({ fields, probe }).typeOf(formula);

  return { type: types.length > 0 ? unionOf(types) : type.any, declared: probe.declared };
}
