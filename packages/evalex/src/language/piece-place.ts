import type { AST } from '../parser';

/** A part of a formula with the node whose values it shows; a name declared with `let` shows the values of its value. */
export interface PiecePlace {
  readonly from: number;
  readonly to: number;
  readonly node: AST.AstNode;
}
