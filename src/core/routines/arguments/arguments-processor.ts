import type { AST } from '../../../parser';
import type { FormulaError } from '../../errors';
import type { FormulaEvaluatorVisitor } from '../../evaluator.visitor';
import type { ArgumentsPattern, ProcessedArguments } from './arguments-definitions';

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
  public readonly definitions: ArgumentsDefinitions;
  private readonly patternMatcher: PatternMatcher;
  private readonly errorCollector: ValidationErrorCollector;

  constructor(argumentDefinitions: ArgumentsPattern | readonly ArgumentsPattern[]) {
    this.definitions = new ArgumentsDefinitions(argumentDefinitions);
    this.patternMatcher = new PatternMatcher(this.definitions);
    this.errorCollector = new ValidationErrorCollector(this.definitions);
  }

  /**
   * Processes AST nodes into ProcessedArguments, trying to match against available patterns.
   * If a pattern matches, returns the processed arguments for that pattern.
   * If no pattern matches, returns processed arguments using the first pattern for error generation.
   */
  public process(args: AST.AstNode[], visitor: FormulaEvaluatorVisitor): ProcessedArguments {
    // Try each pattern to find a match
    for (const pattern of this.definitions.alternatives) {
      const processedArgs = this.processArgsForPattern(args, pattern, visitor);

      if (this.patternMatcher.validatePatternStructure(processedArgs, pattern)) {
        return processedArgs;
      }
    }

    // If none of the patterns matched, use the first one for error generation
    const firstPattern = this.definitions.alternatives[0];
    return this.processArgsForPattern(args, firstPattern, visitor);
  }

  /**
   * Validates if the processed arguments match any of the available patterns.
   */
  public validate(args: ProcessedArguments): boolean {
    return this.patternMatcher.findMatchingPattern(args) !== null;
  }

  /**
   * Gets the best validation error for the provided arguments.
   * Uses the error collector to determine the most relevant error message.
   * @param args The processed arguments to validate
   * @param globalLocation The location of the global error
   * @returns The collected error with all messages in one.
   */
  public getValidationError(
    args: ProcessedArguments,
    globalLocation: AST.Location,
  ): FormulaError {
    return this.errorCollector.collectBestError(args, globalLocation);
  }

  /**
   * Gets validation errors for the provided arguments.
   * @param args The processed arguments to validate
   * @param globalLocation The location of the global error
   * @returns All errors for each pattern.
   */
  public getValidationErrors(
    args: ProcessedArguments,
    globalLocation: AST.Location,
  ): FormulaError[] {
    return this.errorCollector.collectPatternErrors(args, globalLocation);
  }

  /**
   * Processes AST nodes into ProcessedArguments for a specific pattern.
   * @param args The AST nodes to process
   * @param pattern The pattern to process arguments for
   * @param visitor The evaluator visitor
   * @returns Processed arguments for the pattern
   */
  private processArgsForPattern(
    args: AST.AstNode[],
    pattern: ArgumentsPattern,
    visitor: FormulaEvaluatorVisitor,
  ): ProcessedArguments {
    return args.map((arg, index) => {
      const argDef = this.definitions.getArgumentForPattern(index, pattern);

      if (argDef instanceof CallbackArgument) {
        return new CallbackExecutor(arg, visitor, argDef.returnType);
      }

      return new ProcessedArgument(visitor.evaluateNode(arg), arg);
    });
  }
}
