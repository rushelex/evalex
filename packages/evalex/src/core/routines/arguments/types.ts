import type { Argument } from './argument';
import type { ArgumentsPattern } from './arguments-definitions';
import type { CallbackArgument } from './callback-argument';
import type { CallbackExecutor } from './callback-executor';

/** One signature of a routine with a call subject: the subject comes first and is always a value. */
export type SubjectSignature = readonly [Argument, ...(Argument | CallbackArgument)[]];

/** The value a handler receives for an argument definition. */
export type ArgumentValue<TArgument>
  = TArgument extends Argument<infer TValue> ? TValue
  : TArgument extends CallbackArgument<infer TVariables, infer TReturn> ? CallbackExecutor<TVariables, TReturn>
  : never;

/** Handler values for the arguments of a signature: optional ones may be missing, a repeatable one spreads. */
export type ArgumentValues<TArguments extends readonly unknown[]>
  = TArguments extends readonly [infer THead, ...infer TTail]
    ? THead extends { readonly repeatable: true }
      ? ArgumentValue<THead>[]
      : THead extends { readonly optional: true }
        ? [ArgumentValue<THead>?, ...ArgumentValues<TTail>]
        : [ArgumentValue<THead>, ...ArgumentValues<TTail>]
    : [];

/** The subject and the remaining arguments of one signature; a repeatable subject spreads into `args`. */
export type SubjectCall<TSignature extends SubjectSignature>
  = TSignature extends readonly [infer TSubject, ...infer TRest]
    ? TSubject extends { readonly repeatable: true }
      ? { readonly subject: ArgumentValue<TSubject>; readonly args: ArgumentValue<TSubject>[] }
      : { readonly subject: ArgumentValue<TSubject>; readonly args: ArgumentValues<TRest> }
    : never;

/** Signatures given either as one signature or as a list of alternatives. */
export type SubjectSignatures = SubjectSignature | readonly SubjectSignature[];

/** One {@link SubjectCall} per alternative signature. */
export type SubjectCalls<TSignatures extends SubjectSignatures>
  = TSignatures extends SubjectSignature
    ? SubjectCall<TSignatures>
    : TSignatures extends readonly SubjectSignature[]
      ? SubjectCall<TSignatures[number]>
      : never;

/** Signatures of a routine without a call subject: one signature or a list of alternatives. */
export type Signatures = ArgumentsPattern | readonly ArgumentsPattern[];

/** Handler values for the arguments, one tuple per alternative signature. */
export type CallArguments<TSignatures extends Signatures>
  = TSignatures extends ArgumentsPattern
    ? ArgumentValues<TSignatures>
    : TSignatures extends readonly ArgumentsPattern[]
      ? ArgumentValues<TSignatures[number]>
      : never;

/** How a failed call ranks its signatures to pick the error it reports. */
export interface ArgumentsScoringOptions {
  /** Arguments before the checked ones that fit every signature, such as a method's subject; they rank as fitting arguments. */
  readonly precedingMatches?: number;
  /** The first argument is the call subject, so a failed call reports only the signatures that accept its type. */
  readonly subjectFirst?: boolean;
}
