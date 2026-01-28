import type { Expression, FormulaError } from '../core';
import type { DependencyGraph } from './dependency-graph';

import { TypeFormulaError } from '../core';
import { MaxDependenciesExceededError, MaxFormulaDepthExceededError } from './errors';
import { FORMULA_LIMITS } from './limits';

export interface ValidationContext {
  readonly nodeId: string;
  readonly dependenciesCount?: number;
  readonly depth?: number;
  readonly formula?: string;
}

export type ValidationResult
  = | { isValid: true }
    | { isValid: false; error: FormulaError };

/**
 * Validates formulas and their dependencies using existing DependencyGraph.
 */
export class FormulaValidator {
  /**
   * Validates node dependencies count against limits.
   * Uses DependencyGraph for dependency information.
   */
  validateDependencies(nodeId: string, dependencies: ReadonlySet<string>): ValidationResult {
    if (dependencies.size <= FORMULA_LIMITS.MAX_DEPENDENCIES_PER_FORMULA) {
      return { isValid: true };
    }

    return {
      isValid: false,
      error: new MaxDependenciesExceededError(
        `Formula "${nodeId}" exceeds maximum dependencies limit.`,
        {
          context: {
            nodeId,
            count: dependencies.size,
          },
        },
      ),
    };
  }

  /**
   * Validates formula depth using existing DependencyGraph.
   * Delegates depth calculation to graph.
   */
  validateDepth(nodeId: string, graph: DependencyGraph): ValidationResult {
    const depth = graph.getNodeDepth(nodeId);

    if (depth <= FORMULA_LIMITS.MAX_FORMULA_DEPTH) {
      return { isValid: true };
    }

    return {
      isValid: false,
      error: new MaxFormulaDepthExceededError(
        `Formula "${nodeId}" exceeds maximum depth limit.`,
        {
          context: {
            nodeId,
            depth,
          },
        },
      ),
    };
  }

  /**
   * Validates formula string format.
   */
  validateFormula(expression: Expression | undefined | null): ValidationResult {
    if (typeof expression?.formula !== 'string') {
      return {
        isValid: false,
        error: new TypeFormulaError('Formula must be a string', {
          context: {
            expected: 'string',
            actual: typeof expression?.formula,
          },
        }),
      };
    }

    if (expression.formula.trim().length === 0) {
      return {
        isValid: false,
        error: new TypeFormulaError('Formula cannot be empty', {
          context: {
            expected: 'non-empty string',
            actual: expression.formula,
          },
        }),
      };
    }

    return { isValid: true };
  }
}
