import type { Expression } from '../core';
import type { FormulaError } from '../core/errors';

import type { DependencyGraph } from './dependency-graph';

import { Errors } from '../core/errors';
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
      error: Errors.Runtime.MaxDependencies.create({
        nodeId,
        count: dependencies.size,
        limit: FORMULA_LIMITS.MAX_DEPENDENCIES_PER_FORMULA,
      }),
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
      error: Errors.Runtime.MaxFormulaDepth.create({
        nodeId,
        depth,
        limit: FORMULA_LIMITS.MAX_FORMULA_DEPTH,
      }),
    };
  }

  /**
   * Validates formula string format.
   */
  validateFormula(expression: Expression | undefined | null): ValidationResult {
    if (typeof expression?.formula !== 'string') {
      return {
        isValid: false,
        error: Errors.Validation.StringFormulaExpected.create({ actual: typeof expression?.formula }),
      };
    }

    if (expression.formula.trim().length === 0) {
      return {
        isValid: false,
        error: Errors.Validation.NonEmptyFormulaExpected.create({ actual: expression.formula }),
      };
    }

    return { isValid: true };
  }
}
