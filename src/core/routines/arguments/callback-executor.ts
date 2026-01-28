import type { AST } from '../../../parser';
import type { FormulaDataType, Kind } from '../../data-types';
import type { FormulaEvaluatorVisitor } from '../../evaluator.visitor';

export class CallbackExecutor {
  readonly node: AST.AstNode;
  readonly #visitor: FormulaEvaluatorVisitor;
  readonly returnType?: Kind | readonly Kind[];

  constructor(
    node: AST.AstNode,
    visitor: FormulaEvaluatorVisitor,
    returnType?: Kind | readonly Kind[],
  ) {
    this.node = node;
    this.#visitor = visitor;
    this.returnType = returnType;
  }

  execute(context: Record<string, FormulaDataType>): FormulaDataType {
    const nestedContext = this.#visitor.context.createNestedContext(context);
    const callbackVisitor = this.#visitor.cloneWithContext(nestedContext);
    const result = callbackVisitor.evaluateNode(this.node);

    const returnTypes = this.returnType
      ? (Array.isArray(this.returnType) ? this.returnType : [this.returnType])
      : [];

    if (returnTypes.length > 0 && !this.#isTypeMatch(result.kind)) {
      throw new TypeError(`Expected return type ${returnTypes.join(', ')} but got ${result.kind}.`);
    }

    return result;
  }

  get location(): AST.Location {
    return this.node.location;
  }

  #isTypeMatch(actualType: Kind): boolean {
    const expectedTypesArray = Array.isArray(this.returnType) ? this.returnType : [this.returnType];
    return expectedTypesArray.includes(actualType) || expectedTypesArray.includes('any');
  }
}
