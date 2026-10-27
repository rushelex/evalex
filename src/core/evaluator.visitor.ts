import type { AST } from '../parser';
import type { FormulaEvaluationContext } from './context';
import type { RoutineDispatcher } from './routines/dispatcher';
import type { ValueFormat } from './value-format';

import { Temporal } from 'temporal-polyfill';

import { CellReadFailure } from './cell-read-failure';
import {
  areEqual,
  decimalArithmetic,
  FormulaArray,
  FormulaBoolean,
  FormulaDataType,
  FormulaDate,
  FormulaNull,
  FormulaNumber,
  FormulaRegExp,
  FormulaString,
} from './data-types';
import { Errors } from './errors';
import { routineDispatcher } from './routines/dispatcher';

interface EvaluationHooks {
  onIdentifier?: (name: string) => void;
  /** The host's formatters for values the formula turns into text. */
  format?: ValueFormat;
}

/** The latest result of one evaluation and the part of the formula it came from, shared by its nested visitors. */
interface ValueOrigin {
  value?: FormulaDataType;
  location?: AST.Location;
}

export class FormulaEvaluatorVisitor implements AST.IVisitor<FormulaDataType> {
  readonly formula: string;
  context: FormulaEvaluationContext;
  readonly #hooks?: EvaluationHooks;
  readonly #dispatcher: RoutineDispatcher = routineDispatcher;
  readonly #origin: ValueOrigin;

  constructor(
    formula: string,
    context: FormulaEvaluationContext,
    hooks?: EvaluationHooks,
    dispatcher: RoutineDispatcher = routineDispatcher,
    origin: ValueOrigin = {},
  ) {
    this.formula = formula;
    this.context = context;
    this.#hooks = hooks;
    this.#dispatcher = dispatcher;
    this.#origin = origin;
  }

  /**
   * Evaluates a node and records where its result came from, for {@link FormulaEvaluatorVisitor.origin}.
   *
   * @remarks
   * A node that returns the very value its last evaluated part returned, as `if` or `? :` do, keeps that part's
   * origin. A literal or a variable is always its own origin, since one value can stand in several places.
   */
  evaluateNode(node: AST.AstNode): FormulaDataType {
    let result: FormulaDataType;

    try {
      result = node.accept(this);
    }
    catch (error) {
      // Caught by the innermost node only: the error it becomes is no longer a read failure.
      if (error instanceof CellReadFailure) {
        const { location } = node;

        throw error.create({ name: this.formula.slice(location.start.offset, location.end.offset), location });
      }

      throw error;
    }

    const origin = this.#origin;

    // A new value is checked first: most nodes produce one, so the node type is rarely read.
    if (result !== origin.value || node.type === 'Literal' || node.type === 'Identifier') {
      origin.location = node.location;
    }

    origin.value = result;

    return result;
  }

  /** The host's formatters, for every place the formula turns a value into text. */
  get format(): ValueFormat | undefined {
    return this.#hooks?.format;
  }

  /** The part of the formula the latest result came from, so an error about that value can point at it. */
  get origin(): AST.Location | undefined {
    return this.#origin.location;
  }

  /**
   * Evaluates an array of AST nodes.
   */
  evaluateNodes<T extends (FormulaDataType | undefined)[] = FormulaDataType[]>(nodes: AST.AstNode[]): T {
    return nodes.map((node) => this.evaluateNode(node)) as T;
  }

  /**
   * Creates a new instance of FormulaEvaluatorVisitor with a new (nested) context.
   * Used for operations like map, filter, where a new scope is required.
   */
  cloneWithContext(newContext: FormulaEvaluationContext): FormulaEvaluatorVisitor {
    // Important: create a new instance to avoid mutating the current visitor
    return new FormulaEvaluatorVisitor(this.formula, newContext, this.#hooks, this.#dispatcher, this.#origin);
  }

  visitLiteralNode(node: AST.ILiteralNode): FormulaDataType {
    if (typeof node.value === 'string') {
      return new FormulaString(node.value);
    }

    if (typeof node.value === 'number') {
      return new FormulaNumber(node.value);
    }

    if (typeof node.value === 'boolean') {
      return FormulaBoolean.from(node.value);
    }

    if (node.value instanceof RegExp) {
      return FormulaRegExp.from(node.value);
    }

    if (node.value === null || node.value === undefined) {
      return FormulaNull.instance();
    }

    throw new Error(`Unsupported literal type ${typeof node.value} for value ${node.raw}`);
  }

  visitBinaryExpressionNode(node: AST.IBinaryExpressionNode): FormulaDataType {
    const left = this.evaluateNode(node.left);
    const right = this.evaluateNode(node.right);

    switch (node.operator) {
      case '+': {
        // Text joins the other operand as the same text `format()` gives
        if (left instanceof FormulaString || right instanceof FormulaString) {
          return new FormulaString(left.toString({ format: this.format }) + right.toString({ format: this.format }));
        }

        // Numeric addition
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);
        return decimalArithmetic.add(leftNum, rightNum);
      }
      case '-': {
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);
        return decimalArithmetic.subtract(leftNum, rightNum);
      }
      case '*': {
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);
        return decimalArithmetic.multiply(leftNum, rightNum);
      }
      case '/': {
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);

        if (rightNum.value === 0) {
          throw Errors.Arithmetic.DivisionByZero.create(
            { dividend: leftNum.value },
            { location: node.location },
          );
        }

        return decimalArithmetic.divide(leftNum, rightNum);
      }
      case '^': {
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);
        return decimalArithmetic.power(leftNum, rightNum);
      }
      case '%': {
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);

        if (rightNum.value === 0) {
          throw Errors.Arithmetic.ModuloByZero.create(
            { dividend: leftNum.value },
            { location: node.location },
          );
        }

        return decimalArithmetic.remainder(leftNum, rightNum);
      }
      case '==': {
        return FormulaBoolean.from(areEqual(left, right));
      }
      case '!=': {
        return FormulaBoolean.from(!areEqual(left, right));
      }
      case '<': {
        if ((left instanceof FormulaNumber && right instanceof FormulaNumber)
          || (left instanceof FormulaString && right instanceof FormulaString)) {
          return FormulaBoolean.from(left.value < right.value);
        }
        if (left instanceof FormulaDate && right instanceof FormulaDate) {
          return FormulaBoolean.from(Temporal.ZonedDateTime.compare(left.value, right.value) < 0);
        }

        throw Errors.Evaluation.ComparisonTypeMismatch.create(
          { expression: this.formula },
          { location: node.location },
        );
      }
      case '<=': {
        if ((left instanceof FormulaNumber && right instanceof FormulaNumber)
          || (left instanceof FormulaString && right instanceof FormulaString)) {
          return FormulaBoolean.from(left.value <= right.value);
        }
        if (left instanceof FormulaDate && right instanceof FormulaDate) {
          return FormulaBoolean.from(Temporal.ZonedDateTime.compare(left.value, right.value) <= 0);
        }

        throw Errors.Evaluation.ComparisonTypeMismatch.create(
          { expression: this.formula },
          { location: node.location },
        );
      }
      case '>': {
        if ((left instanceof FormulaNumber && right instanceof FormulaNumber)
          || (left instanceof FormulaString && right instanceof FormulaString)) {
          return FormulaBoolean.from(left.value > right.value);
        }
        if (left instanceof FormulaDate && right instanceof FormulaDate) {
          return FormulaBoolean.from(Temporal.ZonedDateTime.compare(left.value, right.value) > 0);
        }

        throw Errors.Evaluation.ComparisonTypeMismatch.create(
          { expression: this.formula },
          { location: node.location },
        );
      }
      case '>=': {
        if ((left instanceof FormulaNumber && right instanceof FormulaNumber)
          || (left instanceof FormulaString && right instanceof FormulaString)) {
          return FormulaBoolean.from(left.value >= right.value);
        }
        if (left instanceof FormulaDate && right instanceof FormulaDate) {
          return FormulaBoolean.from(Temporal.ZonedDateTime.compare(left.value, right.value) >= 0);
        }

        throw Errors.Evaluation.ComparisonTypeMismatch.create(
          { expression: this.formula },
          { location: node.location },
        );
      }
      case 'and':
      case '&&': {
        return FormulaBoolean.from(!left.isEmpty() && !right.isEmpty());
      }
      case 'or':
      case '||': {
        return FormulaBoolean.from(!left.isEmpty() || !right.isEmpty());
      }

      default: {
        throw Errors.Operators.UnsupportedBinary.create(node.operator, { location: node.location });
      }
    }
  }

  visitUnaryExpressionNode(node: AST.IUnaryExpressionNode): FormulaDataType {
    const arg = this.evaluateNode(node.arg);

    switch (node.operator) {
      case '-': {
        if (!(arg instanceof FormulaNumber)) {
          throw Errors.Evaluation.UnaryMinusNonNumeric.create(
            { expression: this.formula },
            { location: node.location },
          );
        }

        return decimalArithmetic.negate(arg);
      }
      case 'not':
      case '!': {
        return FormulaBoolean.from(arg.isEmpty());
      }
      default: {
        throw Errors.Operators.UnsupportedUnary.create(node.operator, { location: node.location });
      }
    }
  }

  visitIdentifierNode(node: AST.IIdentifierNode): FormulaDataType {
    // Callback variables such as `current` are not dependencies of the formula.
    if (!this.context.isLocalVariable(node.name)) {
      this.#hooks?.onIdentifier?.(node.name);
    }

    // An identifier can be a variable from the current lexical context
    // (e.g., "current" in a map function) or a global property.
    // The context handles resolving this.
    const value = this.context.getVariable(node.name);

    if (value instanceof FormulaDataType) {
      return value;
    }

    // If the identifier is not found in the context, it's an error.
    throw Errors.Reference.VariableNotDefined.create(
      { name: node.name },
      { location: node.location },
    );
  }

  visitCallExpressionNode(node: AST.ICallExpressionNode): FormulaDataType {
    const callee = node.callee;

    // Case 1: Call to global function (e.g., now(), parseDate())
    if (callee.type === 'Identifier') {
      const functionName = callee.name;
      return this.#dispatcher.callFunction(functionName, node, this);
    }

    // Case 2: Call to object method (e.g., myList.map(), myString.upper())
    if (callee.type === 'MemberExpression') {
      const objectInstance = this.evaluateNode(callee.object);
      const methodNode = callee.property;

      return this.#dispatcher.callMethod(objectInstance, methodNode, node, this);
    }

    throw new Error('Unsupported call expression type.');
  }

  visitMemberExpressionNode(node: AST.IMemberExpressionNode): FormulaDataType {
    return this.evaluateNode(node.object);
  }

  visitConditionalExpressionNode(node: AST.IConditionalExpressionNode): FormulaDataType {
    const test = this.evaluateNode(node.test);
    return !test.isEmpty() ? this.evaluateNode(node.consequent) : this.evaluateNode(node.alternate);
  }

  visitArrayExpressionNode(node: AST.IArrayExpressionNode): FormulaDataType {
    const items = node.elements.map((el) => this.evaluateNode(el));

    return new FormulaArray(items);
  }

  visitLetExpressionNode(node: AST.ILetExpressionNode): FormulaDataType {
    const scope = this.context.createNestedContext({});
    const visitor = this.cloneWithContext(scope);

    for (const { name, value } of node.declarations) {
      scope.setVariable(name.name, visitor.evaluateNode(value));
    }

    return visitor.evaluateNode(node.body);
  }
}

function checkNumericOperands(
  l: FormulaDataType,
  r: FormulaDataType,
  location: AST.IBinaryExpressionNode['location'],
  formula: string,
): { leftNum: FormulaNumber; rightNum: FormulaNumber } {
  if (!(l instanceof FormulaNumber) || !(r instanceof FormulaNumber)) {
    throw Errors.Evaluation.NonNumericMath.create(
      { expression: formula },
      { location },
    );
  }

  return { leftNum: l, rightNum: r };
}
