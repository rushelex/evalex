import type { InferFormulaDataTypeByKind, Kind } from '../../data-types';
import type { Argument } from './argument';
import type { ArgumentsPattern } from './arguments-definitions';
import type { CallbackArgument } from './callback-argument';
import type { CallbackExecutor } from './callback-executor';
import type { ProcessedArgument } from './processed-argument';
import type { RoutineArguments } from './routine-arguments';

export type InferArgument<T extends Argument<any>>
  = T extends Argument<infer K>
    ? K extends Kind
      ? InferFormulaDataTypeByKind<K>
      : never
    : never;

type ToProcessedArgument<T extends Argument | CallbackArgument>
  = T extends Argument
    ? ProcessedArgument<InferArgument<T>>
    : T extends CallbackArgument
      ? CallbackExecutor
      : never;

type ExcludeHeadArgument<T extends ArgumentsPattern, ExcludeHead extends boolean = false>
  = ExcludeHead extends true
    ? T extends readonly [infer _THead, ...infer TTail]
      ? TTail extends ArgumentsPattern
        ? { +readonly [K in keyof TTail]: ToProcessedArgument<TTail[K]> }
        : never
      : T
    : { +readonly [K in keyof T]: ToProcessedArgument<T[K]> };

type UnwrapArguments<T extends ArgumentsPattern | ReadonlyArray<ArgumentsPattern>, ExcludeHead extends boolean = false>
  = T extends ReadonlyArray<ArgumentsPattern>
    ? { +readonly [K in keyof T]: ExcludeHeadArgument<T[K], ExcludeHead> }
    : T extends ArgumentsPattern
      ? ExcludeHeadArgument<T, ExcludeHead>
      : never;

export type InferRoutineArguments<T extends RoutineArguments | ArgumentsPattern | ReadonlyArray<ArgumentsPattern>, ExcludeHead extends boolean = false>
  = T extends RoutineArguments<infer TPatterns>
    ? UnwrapArguments<TPatterns, ExcludeHead>
    : T extends ArgumentsPattern | ReadonlyArray<ArgumentsPattern>
      ? UnwrapArguments<T, ExcludeHead>
      : never;
