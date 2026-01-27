import type { AST } from '../parser';

export class DependencyExtractorVisitor implements AST.IVisitor<void> {
  private dependencies = new Set<string>();

  public static getDependencies(node: AST.AstNode): ReadonlySet<string> {
    const visitor = new DependencyExtractorVisitor();
    node.accept(visitor);
    return visitor.dependencies;
  }

  public visitLiteralNode(_node: AST.ILiteralNode): void {
    // No dependencies for literals
  }

  public visitBinaryExpressionNode(node: AST.IBinaryExpressionNode): void {
    node.left.accept(this);
    node.right.accept(this);
  }

  public visitUnaryExpressionNode(node: AST.IUnaryExpressionNode): void {
    node.arg.accept(this);
  }

  public visitIdentifierNode(node: AST.IIdentifierNode): void {
    this.dependencies.add(node.name);
  }

  public visitCallExpressionNode(node: AST.ICallExpressionNode): void {
    node.callee.accept(this);

    for (const arg of node.args) {
      arg.accept(this);
    }
  }

  public visitMemberExpressionNode(node: AST.IMemberExpressionNode): void {
    node.object.accept(this);
  }

  public visitConditionalExpressionNode(node: AST.IConditionalExpressionNode): void {
    node.test.accept(this);
    node.consequent.accept(this);
    node.alternate.accept(this);
  }

  public visitArrayExpressionNode(node: AST.IArrayExpressionNode): void {
    for (const element of node.elements) {
      element.accept(this);
    }
  }
}
