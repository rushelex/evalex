import type { AST } from '../parser';
import type { Routine } from './routines/routine';

import { routinesRegistry } from './routines/registry';

export class DependencyExtractorVisitor implements AST.IVisitor<void> {
  #dependencies = new Set<string>();
  #volatile = false;
  // Names introduced by the enclosing callbacks and `let` expressions, innermost last.
  readonly #callbackScopes: ReadonlySet<string>[] = [];

  static getDependencies(node: AST.AstNode): ReadonlySet<string> {
    const visitor = new DependencyExtractorVisitor();
    node.accept(visitor);
    return visitor.#dependencies;
  }

  /** Tells whether the formula calls a routine whose result can differ between calls with the same arguments. */
  static isVolatile(node: AST.AstNode): boolean {
    const visitor = new DependencyExtractorVisitor();
    node.accept(visitor);
    return visitor.#volatile;
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
    if (this.#callbackScopes.some((scope) => scope.has(node.name))) {
      return;
    }

    this.#dependencies.add(node.name);
  }

  visitCallExpressionNode(node: AST.ICallExpressionNode): void {
    const { callee } = node;

    if (callee.type === 'MemberExpression') {
      callee.object.accept(this);
    }

    const routines = callee.type === 'Identifier'
      ? [routinesRegistry.getFunction(callee.name)].filter((routine) => routine !== undefined)
      : getMethodsNamed(callee.property.name);

    // A method's receiver type is unknown here, so one volatile candidate makes the call volatile
    if (routines.some((routine) => routine.volatile)) {
      this.#volatile = true;
    }

    node.args.forEach((arg, index) => {
      const callbackVariables = getSharedCallbackVariables(routines, index);

      if (callbackVariables.size === 0) {
        arg.accept(this);
        return;
      }

      this.#callbackScopes.push(callbackVariables);
      arg.accept(this);
      this.#callbackScopes.pop();
    });
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

  // The parser rejects a value that reads its own or a later name, so every value can see all the names
  visitLetExpressionNode(node: AST.ILetExpressionNode): void {
    this.#callbackScopes.push(new Set(node.declarations.map(({ name }) => name.name)));

    for (const { value } of node.declarations) {
      value.accept(this);
    }

    node.body.accept(this);
    this.#callbackScopes.pop();
  }
}

// The receiver type is unknown before evaluation, so every data type's method with this name is a candidate.
function getMethodsNamed(name: string): Routine[] {
  return routinesRegistry
    .getRegisteredDataTypes()
    .map((ctor) => routinesRegistry.getMethod(ctor, name))
    .filter((routine) => routine !== undefined);
}

// Only names every candidate declares are excluded: a name kept by mistake costs a recalculation,
// a name dropped by mistake leaves a stale result.
function getSharedCallbackVariables(routines: readonly Routine[], argumentIndex: number): ReadonlySet<string> {
  if (routines.length === 0) {
    return new Set();
  }

  const [first, ...rest] = routines.map((routine) => routine.getCallbackVariables(argumentIndex));

  return new Set(first.filter((name) => rest.every((variables) => variables.includes(name))));
}
