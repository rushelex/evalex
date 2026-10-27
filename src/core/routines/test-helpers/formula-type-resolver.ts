import type { FormulaDataType } from '../../data-types';

import { FormulaEvaluationContext } from '~/core/context';

import { FormulaEvaluatorVisitor } from '~/core/evaluator.visitor';

import { parseFormula } from '../../parse-formula';

/**
 * Interface for resolving the data type from a formula string
 */
export interface FormulaTypeResolver {
  /**
   * Resolves the target data type from a method call formula
   * @param formula - The formula string (e.g., '[1,2,3].map(current * 2)')
   * @param context - Context variables that may be referenced in the formula
   * @returns The resolved FormulaDataType or undefined if not resolvable
   */
  resolve: (formula: string | undefined, context: Record<string, FormulaDataType>) => FormulaDataType | undefined;
}

/**
 * Resolves the subject of a method call by evaluating the expression before the dot.
 */
export class ASTBasedFormulaTypeResolver implements FormulaTypeResolver {
  /**
   * @example
   * resolver.resolve('[1,2,3].map(current * 2)', {}) // → FormulaArray
   * resolver.resolve('(-1).log2()', {}) // → FormulaNumber
   * resolver.resolve('obj.empty()', { obj: FormulaObject }) // → FormulaObject
   */
  resolve(formula: string | undefined, context: Record<string, FormulaDataType>): FormulaDataType | undefined {
    if (!formula) {
      return undefined;
    }

    const ast = parseFormula(formula);

    if (ast.type !== 'CallExpression' || ast.callee.type !== 'MemberExpression') {
      return undefined;
    }

    const visitor = new FormulaEvaluatorVisitor(formula, new FormulaEvaluationContext(new Map(Object.entries(context))));

    try {
      return visitor.evaluateNode(ast.callee.object);
    }
    catch {
      // A subject that fails to evaluate has no type to resolve.
      return undefined;
    }
  }
}
