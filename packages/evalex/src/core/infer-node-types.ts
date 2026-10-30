import type { AST } from '../parser';
import type { FormulaType } from './types';

import { TypeInferenceVisitor } from './type-inference.visitor';
import { type, unionOf } from './types';

interface InferNodeTypesOptions {
  /** The parsed formula. */
  readonly formula: AST.AstNode;
  /** The types of the names the formula reads from its record; a name left out holds any value. */
  readonly fields: ReadonlyMap<string, FormulaType>;
  /** Nodes inside `formula`, the nodes themselves rather than equal ones. */
  readonly nodes: readonly AST.AstNode[];
}

/** The type of a node inside a formula, and for a name whether a scope it is read in declares it. */
interface NodeType {
  readonly type: FormulaType;
  readonly declared: boolean;
}

/**
 * The types of nodes inside a formula, each with the names in scope where it stands, such as `current` inside
 * `filter`, found in one pass over the formula.
 *
 * @returns For each node, the union over every scope it is read in, such as each argument list of a routine around it,
 * or `Any` when the formula does not read the node; for a name, also whether a scope it is read in declares it.
 */
export function inferNodeTypes({ formula, fields, nodes }: InferNodeTypesOptions): ReadonlyMap<AST.AstNode, NodeType> {
  const probes = new Map(nodes.map((node) => [node, { types: new Array<FormulaType>(), declared: false }]));

  new TypeInferenceVisitor({ fields, probes }).typeOf(formula);

  return new Map([...probes].map(([node, { types, declared }]) => [node, { type: types.length > 0 ? unionOf(types) : type.any, declared }]));
}
