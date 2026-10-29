import type { AST } from '../../../parser';
import type { FormulaDataType } from '../../data-types';
import type { FormulaEvaluatorVisitor } from '../../evaluator.visitor';

import { Kind } from '../../data-types';
import { Errors } from '../../errors';

interface CallbackExecutorOptions {
  /** The kinds each evaluation must return; any kind when omitted. */
  readonly returnKinds?: readonly Kind[];
  readonly argumentPosition: number;
  readonly argumentName?: string;
}

/** Evaluates a callback argument with the variables its routine provides; the result is checked against the declared return type. */
export class CallbackExecutor<TVariables extends string = string, TReturn extends FormulaDataType = FormulaDataType> {
  readonly node: AST.AstNode;
  readonly #visitor: FormulaEvaluatorVisitor;
  readonly #returnKinds: readonly Kind[];
  readonly #argumentPosition: number;
  readonly #argumentName?: string;

  constructor(
    node: AST.AstNode,
    visitor: FormulaEvaluatorVisitor,
    options: CallbackExecutorOptions,
  ) {
    this.node = node;
    this.#visitor = visitor;
    this.#returnKinds = options.returnKinds ?? [Kind.Any];
    this.#argumentPosition = options.argumentPosition;
    this.#argumentName = options.argumentName;
  }

  execute(context: Readonly<Record<TVariables, FormulaDataType>>): TReturn {
    const nestedContext = this.#visitor.context.createNestedContext(context);
    const callbackVisitor = this.#visitor.cloneWithContext(nestedContext);
    const result = callbackVisitor.evaluateNode(this.node);
    const origin = callbackVisitor.origin ?? this.location;

    if (!this.#returnKinds.includes(Kind.Any) && !this.#returnKinds.includes(result.kind)) {
      throw Errors.Argument.CallbackReturnTypeMismatch.create(
        {
          expected: [...this.#returnKinds],
          actual: result.kind,
          argumentPosition: this.#argumentPosition,
          argumentName: this.#argumentName,
        },
        { location: origin },
      );
    }

    // The return type check above guarantees the declared type.
    return result as TReturn;
  }

  get location(): AST.Location {
    return this.node.location;
  }
}
