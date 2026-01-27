import type { AST } from '../../../parser';
import type { FormulaDataType, Kind } from '../../data-types';
import type { FormulaEvaluatorVisitor } from '../../evaluator.visitor';

export class CallbackExecutor {
  constructor(
    public readonly node: AST.AstNode,
    private readonly visitor: FormulaEvaluatorVisitor,
    public readonly returnType?: Kind | readonly Kind[],
  ) {}

  public execute(context: Record<string, FormulaDataType>): FormulaDataType {
    const nestedContext = this.visitor.context.createNestedContext(context);
    const callbackVisitor = this.visitor.cloneWithContext(nestedContext);
    const result = callbackVisitor.evaluateNode(this.node);

    const returnTypes = this.returnType
      ? (Array.isArray(this.returnType) ? this.returnType : [this.returnType])
      : [];

    if (returnTypes.length > 0 && !this.isTypeMatch(result.kind)) {
      throw new TypeError(`Expected return type ${returnTypes.join(', ')} but got ${result.kind}.`);
    }

    return result;
  }

  public get location(): AST.Location {
    return this.node.location;
  }

  private isTypeMatch(actualType: Kind): boolean {
    const expectedTypesArray = Array.isArray(this.returnType) ? this.returnType : [this.returnType];
    return expectedTypesArray.includes(actualType) || expectedTypesArray.includes('any');
  }
}
