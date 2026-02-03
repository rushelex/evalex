import { FormulaEvaluationContext } from '~/core/context';
import { FormulaEvaluatorVisitor } from '~/core/evaluator.visitor';

import { FormulaDataType } from '../../data-types';
import { convertValueToFormulaType } from '../../data-types/converter';
import { Expression } from '../../expression';

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
 * AST-based implementation of FormulaTypeResolver
 * Parses the formula to extract the target data type from method calls
 */
export class ASTBasedFormulaTypeResolver implements FormulaTypeResolver {
  /**
   * Resolves the data type from a formula string by parsing its AST
   * @example
   * resolver.resolve('[1,2,3].map(current * 2)', {}) // → FormulaArray
   * resolver.resolve('"hello".empty()', {}) // → FormulaString
   * resolver.resolve('obj.empty()', { obj: FormulaObject }) // → FormulaObject
   */
  resolve(formula: string | undefined, context: Record<string, FormulaDataType>): FormulaDataType | undefined {
    if (!formula) {
      return undefined;
    }

    const instance = this.#parseInstance(formula);

    if (instance instanceof FormulaDataType) {
      return instance;
    }

    if (context && instance?.dependencyName) {
      return context[instance.dependencyName];
    }

    return undefined;
  }

  /**
   * Parses the formula AST to extract the instance (target) of a method call
   * @returns FormulaDataType for literals/arrays, or dependency reference for identifiers
   */
  #parseInstance(formula: string): FormulaDataType | { dependencyName: string } | undefined {
    const expression = new Expression(formula);
    const ast = expression.parse();

    if (ast.type !== 'CallExpression') {
      return undefined;
    }

    if (ast.callee.type !== 'MemberExpression') {
      return undefined;
    }

    if (ast.callee.object.type === 'Literal') {
      return convertValueToFormulaType(ast.callee.object.value);
    }

    if (ast.callee.object.type === 'ArrayExpression') {
      return convertValueToFormulaType(ast.callee.object.elements);
    }

    if (ast.callee.object.type === 'Identifier') {
      const dependencies = expression.extractDependencies(ast);

      if (!dependencies.has(ast.callee.object.name)) {
        return undefined;
      }

      return { dependencyName: ast.callee.object.name };
    }

    if (ast.callee.object.type === 'CallExpression') {
      if (ast.callee.object.callee.type !== 'Identifier') {
        return undefined;
      }

      if (ast.callee.property.type !== 'Identifier') {
        return undefined;
      }

      const ctx = new FormulaEvaluationContext();
      const visitor = new FormulaEvaluatorVisitor(formula, ctx);
      return visitor.evaluateNode(ast.callee.object);
    }

    return undefined;
  }
}
