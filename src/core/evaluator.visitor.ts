import type { AST } from '../parser';
import type { FormulaEvaluationContext } from './context';
import type { RoutineDispatcher } from './routines/dispatcher';

import { Temporal } from 'temporal-polyfill';

import {
  FormulaArray,
  FormulaBoolean,
  FormulaDataType,
  FormulaDate,
  FormulaNull,
  FormulaNumber,
  FormulaString,
} from './data-types';
import { Errors } from './errors';
import { routineDispatcher } from './routines/dispatcher';

interface EvaluationHooks {
  onIdentifier?: (name: string) => void;
}

export class FormulaEvaluatorVisitor implements AST.IVisitor<FormulaDataType> {
  readonly formula: string;
  context: FormulaEvaluationContext;
  readonly #hooks?: EvaluationHooks;
  readonly #dispatcher: RoutineDispatcher = routineDispatcher;

  constructor(
    formula: string,
    context: FormulaEvaluationContext,
    hooks?: EvaluationHooks,
    dispatcher: RoutineDispatcher = routineDispatcher,
  ) {
    this.formula = formula;
    this.context = context;
    this.#hooks = hooks;
    this.#dispatcher = dispatcher;
  }

  /**
   * Basic method for evaluating any AST node.
   */
  evaluateNode(node: AST.AstNode): FormulaDataType {
    return node.accept(this);
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
    return new FormulaEvaluatorVisitor(this.formula, newContext, this.#hooks, this.#dispatcher);
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
        // Special case: string addition (concatenation)
        if (left instanceof FormulaString || right instanceof FormulaString) {
          const leftStr = left instanceof FormulaString ? left.value : String(left.value); // Try to convert to string if not string
          const rightStr = right instanceof FormulaString ? right.value : String(right.value);
          return new FormulaString(leftStr + rightStr);
        }

        // Numeric addition
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);
        return FormulaNumber.from(leftNum.value + rightNum.value);
      }
      case '-': {
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);
        return FormulaNumber.from(leftNum.value - rightNum.value);
      }
      case '*': {
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);
        return FormulaNumber.from(leftNum.value * rightNum.value);
      }
      case '/': {
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);

        if (rightNum.value === 0) {
          throw Errors.Arithmetic.DivisionByZero.create(
            { dividend: leftNum.value },
            { location: node.location },
          );
        }

        return FormulaNumber.from(leftNum.value / rightNum.value);
      }
      case '^': {
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);
        return FormulaNumber.from(leftNum.value ** rightNum.value);
      }
      case '%': {
        const { leftNum, rightNum } = checkNumericOperands(left, right, node.location, this.formula);

        if (rightNum.value === 0) {
          throw Errors.Arithmetic.ModuloByZero.create(
            { dividend: leftNum.value },
            { location: node.location },
          );
        }

        return FormulaNumber.from(leftNum.value % rightNum.value);
      }
      case '==': {
        // Handle null comparisons first
        if (left instanceof FormulaNull && right instanceof FormulaNull) {
          return FormulaBoolean.from(true); // null == null is true
        }

        // If one is null and the other is not, they are not equal.
        if (left instanceof FormulaNull || right instanceof FormulaNull) {
          return FormulaBoolean.from(false);
        }

        // If types are different (and neither is null), they are not equal for '=='.
        if (left.kind !== right.kind) {
          return FormulaBoolean.from(false);
        }

        // For same types (Number, String, Boolean), compare their values.
        return FormulaBoolean.from(left.value === right.value);
      }
      case '!=': {
        if (left.kind !== right.kind) {
          return FormulaBoolean.from(true);
        }

        return FormulaBoolean.from(left.value !== right.value);
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
        return FormulaBoolean.from(!!left.value && !!right.value);
      }
      case 'or':
      case '||': {
        return FormulaBoolean.from(!!left.value || !!right.value);
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

        return FormulaNumber.from(-arg.value);
      }
      case 'not':
      case '!': {
        return FormulaBoolean.from(!arg.value);
      }
      default: {
        throw Errors.Operators.UnsupportedUnary.create(node.operator, { location: node.location });
      }
    }
  }

  visitIdentifierNode(node: AST.IIdentifierNode): FormulaDataType {
    this.#hooks?.onIdentifier?.(node.name);

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
