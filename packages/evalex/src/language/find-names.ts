import type { AST } from '../parser';
import type { NamePlace } from './name-place';

/** Every name of a formula with the role it plays, in the order of the text; placeholders of skipped errors have none. */
export function findNames(formula: AST.AstNode): NamePlace[] {
  const names: NamePlace[] = [];

  formula.accept(new NameCollector(names));

  return names;
}

/** Descends into the parts of each node in the order of the text, gathering each name with its role. */
class NameCollector implements AST.IVisitor<void> {
  readonly #names: NamePlace[];

  constructor(names: NamePlace[]) {
    this.#names = names;
  }

  visitLiteralNode(): void {}

  visitIdentifierNode(node: AST.IIdentifierNode): void {
    this.#names.push({ role: 'read', name: node, value: node });
  }

  visitUnaryExpressionNode(node: AST.IUnaryExpressionNode): void {
    this.#visit([node.arg]);
  }

  visitBinaryExpressionNode(node: AST.IBinaryExpressionNode): void {
    this.#visit([node.left, node.right]);
  }

  visitCallExpressionNode(node: AST.ICallExpressionNode): void {
    const { callee, args } = node;

    if (callee.type === 'Identifier') {
      this.#names.push({ role: 'function', name: callee, value: node });
      this.#visit(args);

      return;
    }

    this.#visit([callee.object]);
    this.#names.push({ role: 'method', name: callee.property, value: node, subject: callee.object });
    this.#visit(args);
  }

  visitMemberExpressionNode(node: AST.IMemberExpressionNode): void {
    this.#visit([node.object]);
  }

  visitConditionalExpressionNode(node: AST.IConditionalExpressionNode): void {
    this.#visit([node.test, node.consequent, node.alternate]);
  }

  visitArrayExpressionNode(node: AST.IArrayExpressionNode): void {
    this.#visit(node.elements);
  }

  visitLetExpressionNode(node: AST.ILetExpressionNode): void {
    for (const declaration of node.declarations) {
      this.#names.push({ role: 'declaration', name: declaration.name, value: declaration.value });
      this.#visit([declaration.value]);
    }

    this.#visit([node.body]);
  }

  #visit(nodes: readonly AST.AstNode[]): void {
    for (const node of nodes) {
      node.accept(this);
    }
  }
}
