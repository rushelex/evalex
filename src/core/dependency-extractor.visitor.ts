import type { AST } from '../parser';

export class DependencyExtractorVisitor implements AST.IVisitor<void> {
  #dependencies = new Set<string>();

  static getDependencies(node: AST.AstNode): ReadonlySet<string> {
    const visitor = new DependencyExtractorVisitor();
    node.accept(visitor);
    return visitor.#dependencies;
  }

  visitLiteralNode(_node: AST.ILiteralNode): void {
    // No dependencies for literals
  }

  visitBinaryExpressionNode(node: AST.IBinaryExpressionNode): void {
    node.left.accept(this);
    node.right.accept(this);
  }

  visitUnaryExpressionNode(node: AST.IUnaryExpressionNode): void {
    node.arg.accept(this);
  }

  visitIdentifierNode(node: AST.IIdentifierNode): void {
    this.#dependencies.add(node.name);
  }

  visitCallExpressionNode(node: AST.ICallExpressionNode): void {
    node.callee.accept(this);

    for (const arg of node.args) {
      arg.accept(this);
    }
  }

  visitMemberExpressionNode(node: AST.IMemberExpressionNode): void {
    node.object.accept(this);
  }

  visitConditionalExpressionNode(node: AST.IConditionalExpressionNode): void {
    node.test.accept(this);
    node.consequent.accept(this);
    node.alternate.accept(this);
  }

  visitArrayExpressionNode(node: AST.IArrayExpressionNode): void {
    for (const element of node.elements) {
      element.accept(this);
    }
  }
}
