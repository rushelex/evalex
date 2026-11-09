import type { AST } from '../parser';
import type { PiecePlace } from './piece-place';

/** Every part of a formula that evaluates to a value, each after the parts that hold it; the name of a call is part of the call. */
export function findPieces(formula: AST.AstNode): PiecePlace[] {
  const pieces: PiecePlace[] = [];

  formula.accept(new PieceCollector(pieces));

  return pieces;
}

/** Descends into the parts of each node, gathering every node evaluation reaches with its span. */
class PieceCollector implements AST.IVisitor<void> {
  readonly #pieces: PiecePlace[];

  constructor(pieces: PiecePlace[]) {
    this.#pieces = pieces;
  }

  visitLiteralNode(node: AST.ILiteralNode): void {
    this.#add(node);
  }

  visitIdentifierNode(node: AST.IIdentifierNode): void {
    this.#add(node);
  }

  visitUnaryExpressionNode(node: AST.IUnaryExpressionNode): void {
    this.#add(node);
    this.#visit([node.arg]);
  }

  visitBinaryExpressionNode(node: AST.IBinaryExpressionNode): void {
    this.#add(node);
    this.#visit([node.left, node.right]);
  }

  visitCallExpressionNode(node: AST.ICallExpressionNode): void {
    const { callee, args } = node;

    this.#add(node);
    this.#visit(callee.type === 'Identifier' ? args : [callee.object, ...args]);
  }

  visitMemberExpressionNode(node: AST.IMemberExpressionNode): void {
    this.#add(node);
    this.#visit([node.object]);
  }

  visitConditionalExpressionNode(node: AST.IConditionalExpressionNode): void {
    this.#add(node);
    this.#visit([node.test, node.consequent, node.alternate]);
  }

  visitArrayExpressionNode(node: AST.IArrayExpressionNode): void {
    this.#add(node);
    this.#visit(node.elements);
  }

  visitLetExpressionNode(node: AST.ILetExpressionNode): void {
    this.#add(node);

    for (const { name, value } of node.declarations) {
      this.#pieces.push({ from: name.location.start.offset, to: name.location.end.offset, node: value });
      this.#visit([value]);
    }

    this.#visit([node.body]);
  }

  #add(node: AST.AstNode): void {
    this.#pieces.push({ from: node.location.start.offset, to: node.location.end.offset, node });
  }

  #visit(nodes: readonly AST.AstNode[]): void {
    for (const node of nodes) {
      node.accept(this);
    }
  }
}
