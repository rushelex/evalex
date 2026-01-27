import type { Argument } from './argument';
import type { CallbackArgument } from './callback-argument';
import type { CallbackExecutor } from './callback-executor';
import type { ProcessedArgument } from './processed-argument';

export type ArgumentsPattern = ReadonlyArray<Argument | CallbackArgument>;

/**
 * Processed arguments can contain both FormulaDataType and CallbackExecutor instances
 */
export type ProcessedArguments = (ProcessedArgument | CallbackExecutor)[];

export class ArgumentsDefinitions {
  public readonly alternatives: readonly ArgumentsPattern[];

  constructor(
    private readonly definitions: ArgumentsPattern | ReadonlyArray<ArgumentsPattern>,
  ) {
    this.alternatives = Array.isArray(this.definitions[0])
      ? this.definitions as ReadonlyArray<ArgumentsPattern>
      : [this.definitions as ArgumentsPattern];
  }

  public getRequiredCount(pattern: ArgumentsPattern): number {
    return pattern.filter((arg) => !arg.optional).length;
  }

  public hasRepeatableArg(pattern: ArgumentsPattern): pattern is Argument[] {
    return pattern.some((arg) => 'repeatable' in arg && !!arg.repeatable);
  }

  public getMaxCount(pattern: ArgumentsPattern): number {
    return this.hasRepeatableArg(pattern) ? Infinity : pattern.length;
  }

  public getArgumentForPattern(argIndex: number, pattern: ArgumentsPattern): Argument | CallbackArgument | undefined {
    if (argIndex < pattern.length) {
      return pattern[argIndex];
    }

    return pattern.findLast((arg) => 'repeatable' in arg && !!arg.repeatable);
  }
}
