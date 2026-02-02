import type { AST } from '../parser';
import type { FormulaDataType } from './data-types';

import { parse } from '../parser';
import { FormulaEvaluationContext } from './context';
import { DependencyExtractorVisitor } from './dependency-extractor.visitor';
import { FormulaEvaluatorVisitor } from './evaluator.visitor';

const astCache = new Map<string, AST.AstNode>();
const dependenciesCache = new Map<string, ReadonlySet<string>>();
// Shared empty map to avoid allocations
const EMPTY_MAP = new Map<string, FormulaDataType>();

export interface EvaluateOptions {
  readonly context?: Readonly<Record<string, FormulaDataType>> | ReadonlyMap<string, FormulaDataType>;
}

export interface EvaluateResult {
  /** The result of the evaluation. */
  readonly result: FormulaDataType;
  /** The set of active dependencies that were actually accessed during evaluation. */
  readonly dependencies: ReadonlySet<string>;
}

export class Expression {
  readonly formula: string;

  constructor(formula: string) {
    this.formula = formula;
  }

  /**
   * Parses a formula string and returns its AST.
   * Caches the AST for reuse.
   * @returns The AST of the parsed formula.
   */
  parse(): AST.AstNode {
    if (!astCache.has(this.formula)) {
      astCache.set(this.formula, parse(this.formula));
    }

    return astCache.get(this.formula)!;
  }

  /**
   * Extracts dependencies from a formula string.
   * @param ast Optional AST of the formula. If not provided, it will be parsed.
   * @returns A set of static dependency ids.
   */
  extractDependencies(ast = this.parse()): ReadonlySet<string> {
    if (!dependenciesCache.has(this.formula)) {
      dependenciesCache.set(this.formula, DependencyExtractorVisitor.getDependencies(ast));
    }

    return dependenciesCache.get(this.formula)!;
  }

  /**
   * Evaluates a formula string and returns the resulting FormulaDataType.
   * @param options Optional configuration for the evaluation.
   * @returns The result and active dependencies of the evaluation.
   */
  evaluate(options: EvaluateOptions = {}): EvaluateResult {
    const ast = this.parse();

    let initialProperties: Map<string, FormulaDataType>;
    if (options.context instanceof Map) {
      // Fast path: use pre-built map directly (no copy needed, it's readonly)
      initialProperties = options.context as Map<string, FormulaDataType>;
    }
    else if (options.context) {
      initialProperties = new Map<string, FormulaDataType>(Object.entries(options.context));
    }
    else {
      initialProperties = EMPTY_MAP;
    }

    const context = new FormulaEvaluationContext(initialProperties);

    const dependencies = new Set<string>();

    const visitor = new FormulaEvaluatorVisitor(
      this.formula,
      context,
      {
        onIdentifier: (id) => dependencies.add(id),
      },
    );

    const result = visitor.evaluateNode(ast);

    return {
      result,
      dependencies,
    };
  }
}
