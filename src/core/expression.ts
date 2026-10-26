import type { AST } from '../parser';
import type { GlobalProperties } from './context';
import type { FormulaDataType } from './data-types';
import type { ValueFormat } from './value-format';

import { parse } from '../parser';
import { FormulaEvaluationContext } from './context';
import { DependencyExtractorVisitor } from './dependency-extractor.visitor';
import { FormulaEvaluatorVisitor } from './evaluator.visitor';
import { LRUCache } from './lru-cache';
import { validateValueFormat } from './value-format';

/** A formula text parsed once, with what the runtime derives from it filled in on first use. */
export interface ParsedFormula {
  readonly ast: AST.AstNode;
  dependencies?: ReadonlySet<string>;
  volatile?: boolean;
}

/** How many distinct formula texts keep their parse once no living expression holds it. */
export const PARSED_TEXTS_CAPACITY = 1000;

// Formula texts come from the host and its users, so the cache shared by equal texts is bounded
const parsedTexts = new LRUCache<string, ParsedFormula>(PARSED_TEXTS_CAPACITY);
// An expression the runtime holds keeps its parse, so more formulas than the capacity are not parsed again and again
const parsedExpressions = new WeakMap<Expression, ParsedFormula>();
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

/** @throws SyntaxError when the text is not a valid formula. */
function parseText(formula: string): ParsedFormula {
  let parsed = parsedTexts.get(formula);

  if (!parsed) {
    parsed = { ast: parse(formula) };
    parsedTexts.set(formula, parsed);
  }

  return parsed;
}

/**
 * Parses formula text into its AST, cached per text among the most recently used texts.
 * Lives outside `Expression` so the AST stays out of the package's public types.
 * @throws SyntaxError when the text is not a valid formula.
 */
export function parseFormula(formula: string): AST.AstNode {
  return parseText(formula).ast;
}

/**
 * The parse of an expression, kept for as long as the expression lives.
 * @throws SyntaxError when the text is not a valid formula.
 */
export function parseExpression(expression: Expression): ParsedFormula {
  let parsed = parsedExpressions.get(expression);

  if (!parsed) {
    parsed = parseText(expression.formula);
    parsedExpressions.set(expression, parsed);
  }

  return parsed;
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
    const parsed = parseExpression(this);

    parsed.dependencies ??= DependencyExtractorVisitor.getDependencies(parsed.ast);

    return parsed.dependencies;
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

    return evaluateFormula({ formula: this.formula, ast: parseExpression(this).ast, properties, format: options.format });
  }
}

/**
 * Evaluates a parsed formula over values found by name, the step `Expression` and `FormulaScope` share.
 * The format is expected to be validated by the caller, once per format rather than once per evaluation.
 * @throws FormulaError when the formula fails.
 */
export function evaluateFormula({ formula, ast, properties, format }: {
  formula: string;
  ast: AST.AstNode;
  properties: GlobalProperties;
  format: ValueFormat | undefined;
}): EvaluateResult {
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
