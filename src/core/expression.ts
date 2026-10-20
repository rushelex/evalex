import type { AST } from '../parser';
import type { GlobalProperties } from './context';
import type { FormulaDataType } from './data-types';
import type { ValueFormat } from './value-format';

import { parse } from '../parser';
import { FormulaEvaluationContext } from './context';
import { DependencyExtractorVisitor } from './dependency-extractor.visitor';
import { FormulaEvaluatorVisitor } from './evaluator.visitor';
import { validateValueFormat } from './value-format';

const astCache = new Map<string, AST.AstNode>();
const dependenciesCache = new Map<string, ReadonlySet<string>>();
// Shared empty map to avoid allocations
const EMPTY_MAP = new Map<string, FormulaDataType>();

export interface EvaluateOptions {
  readonly context?: Readonly<Record<string, FormulaDataType>> | ReadonlyMap<string, FormulaDataType>;
  /** How values look when the formula turns them into text. */
  readonly format?: ValueFormat;
}

export interface EvaluateResult {
  /** The result of the evaluation. */
  readonly result: FormulaDataType;
  /** The set of active dependencies that were actually accessed during evaluation. */
  readonly dependencies: ReadonlySet<string>;
}

/**
 * Parses formula text into its AST, cached per text.
 * Lives outside `Expression` so the AST stays out of the package's public types.
 * @throws SyntaxError when the text is not a valid formula.
 */
export function parseFormula(formula: string): AST.AstNode {
  if (!astCache.has(formula)) {
    astCache.set(formula, parse(formula));
  }

  return astCache.get(formula)!;
}

export class Expression {
  readonly formula: string;

  constructor(formula: string) {
    this.formula = formula;
  }

  /**
   * Extracts dependencies from a formula string.
   * @returns A set of static dependency ids.
   */
  extractDependencies(): ReadonlySet<string> {
    if (!dependenciesCache.has(this.formula)) {
      dependenciesCache.set(this.formula, DependencyExtractorVisitor.getDependencies(parseFormula(this.formula)));
    }

    return dependenciesCache.get(this.formula)!;
  }

  /**
   * Evaluates a formula string and returns the resulting FormulaDataType.
   * @param options Optional configuration for the evaluation.
   * @returns The result and active dependencies of the evaluation.
   */
  evaluate(options: EvaluateOptions = {}): EvaluateResult {
    validateValueFormat(options.format);

    let properties: GlobalProperties;
    if (options.context instanceof Map) {
      // Fast path: use pre-built map directly (no copy needed, it's readonly)
      properties = options.context as Map<string, FormulaDataType>;
    }
    else if (options.context) {
      properties = new Map<string, FormulaDataType>(Object.entries(options.context));
    }
    else {
      properties = EMPTY_MAP;
    }

    return evaluateFormula({ formula: this.formula, properties, format: options.format });
  }
}

/**
 * Evaluates formula text over values found by name, the step `Expression` and `FormulaScope` share.
 * The format is expected to be validated by the caller, once per format rather than once per evaluation.
 * @throws SyntaxError when the text is not a valid formula, FormulaError when the formula fails.
 */
export function evaluateFormula({ formula, properties, format }: { formula: string; properties: GlobalProperties; format: ValueFormat | undefined }): EvaluateResult {
  const ast = parseFormula(formula);
  const dependencies = new Set<string>();

  const visitor = new FormulaEvaluatorVisitor(
    formula,
    new FormulaEvaluationContext(properties),
    {
      onIdentifier: (id) => dependencies.add(id),
      format,
    },
  );

  const result = visitor.evaluateNode(ast);

  return {
    result,
    dependencies,
  };
}
