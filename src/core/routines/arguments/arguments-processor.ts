import type { AST } from '../../../parser';
import type { FormulaError } from '../../errors';
import type { FormulaEvaluatorVisitor } from '../../evaluator.visitor';
import type { ArgumentsPattern, ProcessedArguments } from './arguments-definitions';
import type { ArgumentsScoringOptions } from './types';

import { ArgumentsDefinitions } from './arguments-definitions';
import { CallbackArgument } from './callback-argument';
import { CallbackExecutor } from './callback-executor';
import { PatternMatcher } from './pattern-matcher';
import { ProcessedArgument } from './processed-argument';
import { ValidationErrorCollector } from './validation-error-collector';

/**
 * Processes and validates arguments based on defined patterns.
 */
export class ArgumentsProcessor {
  readonly definitions: ArgumentsDefinitions;
  readonly #patternMatcher: PatternMatcher;
  readonly #errorCollector: ValidationErrorCollector;

  constructor(argumentDefinitions: ArgumentsPattern | readonly ArgumentsPattern[], scoring: ArgumentsScoringOptions = {}) {
    this.definitions = new ArgumentsDefinitions(argumentDefinitions);
    this.#patternMatcher = new PatternMatcher(this.definitions);
    this.#errorCollector = new ValidationErrorCollector(this.definitions, scoring);
  }

  /**
   * Processes AST nodes into ProcessedArguments, trying to match against available patterns.
   * If a pattern matches, returns the processed arguments for that pattern.
   * If no pattern matches, returns processed arguments using the first pattern for error generation.
   */
  process(args: AST.AstNode[], visitor: FormulaEvaluatorVisitor): ProcessedArguments {
    return this.processWith({ args, visitor, valueOf: (node) => new ProcessedArgument(visitor.evaluateNode(node), node, visitor.origin) });
  }

  /**
   * Processes arguments as `process` does, with the value of each value argument from `valueOf`, so a check can stand
   * in a value of the kind an argument may have for the value the argument evaluates to.
   */
  processWith({ args, visitor, valueOf }: { args: readonly AST.AstNode[]; visitor: FormulaEvaluatorVisitor; valueOf: (node: AST.AstNode) => ProcessedArgument }): ProcessedArguments {
    // Try each pattern to find a match
    for (const pattern of this.definitions.alternatives) {
      const processedArgs = this.#processArgsForPattern({ args, pattern, visitor, valueOf });

      if (this.#patternMatcher.validatePatternStructure(processedArgs, pattern)) {
        return processedArgs;
      }
    }

    // If none of the patterns matched, use the first one for error generation
    const firstPattern = this.definitions.alternatives[0];
    return this.#processArgsForPattern({ args, pattern: firstPattern, visitor, valueOf });
  }

  /**
   * Validates if the processed arguments match any of the available patterns.
   */
  validate(args: ProcessedArguments): boolean {
    return this.#patternMatcher.findMatchingPattern(args) !== null;
  }

  /**
   * Gets the best validation error for the provided arguments.
   * Uses the error collector to determine the most relevant error message.
   * @param args The processed arguments to validate
   * @param globalLocation The location of the global error
   * @returns The collected error with all messages in one.
   */
  getValidationError(
    args: ProcessedArguments,
    globalLocation: AST.Location,
  ): FormulaError {
    return this.#errorCollector.collectBestError(args, globalLocation);
  }

  /**
   * Gets validation errors for the provided arguments.
   * @param args The processed arguments to validate
   * @param globalLocation The location of the global error
   * @returns All errors for each pattern.
   */
  getValidationErrors(
    args: ProcessedArguments,
    globalLocation: AST.Location,
  ): FormulaError[] {
    return this.#errorCollector.collectPatternErrors(args, globalLocation);
  }

  /** Processes AST nodes into ProcessedArguments for a specific pattern. */
  #processArgsForPattern({ args, pattern, visitor, valueOf }: {
    args: readonly AST.AstNode[];
    pattern: ArgumentsPattern;
    visitor: FormulaEvaluatorVisitor;
    valueOf: (node: AST.AstNode) => ProcessedArgument;
  }): ProcessedArguments {
    return args.map((arg, index) => {
      const argDef = this.definitions.getArgumentForPattern(index, pattern);

      if (argDef instanceof CallbackArgument) {
        return new CallbackExecutor(arg, visitor, {
          returnKinds: argDef.returnKinds,
          argumentPosition: index + 1,
          argumentName: argDef.name,
        });
      }

      return valueOf(arg);
    });
  }
}
