import type { AST } from '../parser';
import type { NamePlace } from './name-place';

/**
 * Finds the name at an offset of a formula, the end of the name included, so a caret right after a name is at it.
 *
 * @returns `undefined` where no name stands, such as in a literal, an operator or a placeholder of a skipped error.
 */
export function findName({ formula, offset }: { readonly formula: AST.AstNode; readonly offset: number }): NamePlace | undefined {
  return formula.accept(new NameFinder(offset));
}

/** Descends into the parts of each node, in the order of the text, down to the name at the offset. */
class NameFinder implements AST.IVisitor<NamePlace | undefined> {
  readonly #offset: number;

  constructor(offset: number) {
    this.#offset = offset;
  }

  visitLiteralNode(): undefined {
    return undefined;
  }

  visitIdentifierNode(node: AST.IIdentifierNode): NamePlace | undefined {
    return this.#isAt(node) ? { role: 'read', name: node, value: node } : undefined;
  }

  visitUnaryExpressionNode(node: AST.IUnaryExpressionNode): NamePlace | undefined {
    return this.#findIn([node.arg]);
  }

  visitBinaryExpressionNode(node: AST.IBinaryExpressionNode): NamePlace | undefined {
    return this.#findIn([node.left, node.right]);
  }

  visitCallExpressionNode(node: AST.ICallExpressionNode): NamePlace | undefined {
    const { callee, args } = node;

    if (callee.type === 'Identifier') {
      return this.#isAt(callee) ? { role: 'function', name: callee, value: node } : this.#findIn(args);
    }

    if (this.#isAt(callee.property)) {
      return { role: 'method', name: callee.property, value: node, subject: callee.object };
    }

    return this.#findIn([callee.object, ...args]);
  }

  visitMemberExpressionNode(node: AST.IMemberExpressionNode): NamePlace | undefined {
    return this.#findIn([node.object]);
  }

  visitConditionalExpressionNode(node: AST.IConditionalExpressionNode): NamePlace | undefined {
    return this.#findIn([node.test, node.consequent, node.alternate]);
  }

  visitArrayExpressionNode(node: AST.IArrayExpressionNode): NamePlace | undefined {
    return this.#findIn(node.elements);
  }

  visitLetExpressionNode(node: AST.ILetExpressionNode): NamePlace | undefined {
    const declaration = node.declarations.find(({ name }) => this.#isAt(name));

    if (declaration) {
      return { role: 'declaration', name: declaration.name, value: declaration.value };
    }

    return this.#findIn([...node.declarations.map(({ value }) => value), node.body]);
  }

  #isAt({ location }: AST.IIdentifierNode): boolean {
    return location.start.offset <= this.#offset && this.#offset <= location.end.offset;
  }

  #findIn(nodes: readonly AST.AstNode[]): NamePlace | undefined {
    for (const node of nodes) {
      const found = node.accept(this);

      if (found) {
        return found;
      }
    }

    return undefined;
  }
}
