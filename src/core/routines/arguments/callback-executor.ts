import type { AST } from '../../../parser';
import type { FormulaDataType } from '../../data-types';
import type { FormulaEvaluatorVisitor } from '../../evaluator.visitor';

import { Kind } from '../../data-types';
import { Errors } from '../../errors';

interface CallbackExecutorOptions {
  readonly returnType?: Kind | Kind[];
  readonly argumentPosition: number;
  readonly argumentName?: string;
}

/** Evaluates a callback argument with the variables its routine provides; the result is checked against the declared return type. */
export class CallbackExecutor<TVariables extends string = string, TReturn extends FormulaDataType = FormulaDataType> {
  readonly node: AST.AstNode;
  readonly #visitor: FormulaEvaluatorVisitor;
  readonly returnType?: Kind | Kind[];
  readonly #argumentPosition: number;
  readonly #argumentName?: string;

  constructor(
    node: AST.AstNode,
    visitor: FormulaEvaluatorVisitor,
    options: CallbackExecutorOptions,
  ) {
    this.node = node;
    this.#visitor = visitor;
    this.returnType = options.returnType;
    this.#argumentPosition = options.argumentPosition;
    this.#argumentName = options.argumentName;
  }

  execute(context: Readonly<Record<TVariables, FormulaDataType>>): TReturn {
    const nestedContext = this.#visitor.context.createNestedContext(context);
    const callbackVisitor = this.#visitor.cloneWithContext(nestedContext);
    const result = callbackVisitor.evaluateNode(this.node);

    const returnTypes = this.returnType
      ? (Array.isArray(this.returnType) ? this.returnType : [this.returnType])
      : [];

    if (returnTypes.length > 0 && !this.#isTypeMatch(result.kind)) {
      throw Errors.Argument.CallbackReturnTypeMismatch.create(
        {
          expected: returnTypes,
          actual: result.kind,
          argumentPosition: this.#argumentPosition,
          argumentName: this.#argumentName,
        },
        { location: this.location },
      );
    }

    // The return type check above guarantees the declared type.
    return result as TReturn;
  }

  get location(): AST.Location {
    return this.node.location;
  }

  #isTypeMatch(actualType: Kind): boolean {
    const expectedTypesArray = Array.isArray(this.returnType) ? this.returnType : [this.returnType];
    return expectedTypesArray.includes(actualType) || expectedTypesArray.includes(Kind.Any);
  }
}
