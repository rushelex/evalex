import type { FormulaDataType, FormulaDataTypeByKind, FormulaString } from '../../data-types';
import type { ArgumentValidationFailure } from './argument';

import { Kind } from '../../data-types';
import { Argument } from './argument';
import { CallbackArgument } from './callback-argument';

interface ArgumentFlags {
  readonly optional?: boolean;
  readonly repeatable?: boolean;
}

interface ValueArgumentOptions<TValue extends FormulaDataType> extends ArgumentFlags {
  readonly validation?: (dataType: TValue) => ArgumentValidationFailure | undefined;
}

interface CallbackOptions<TVariables extends string, TReturnKind extends Kind> {
  /** Variables the routine puts in scope for each evaluation, such as `current` and `index`. */
  readonly variables: readonly TVariables[];
  /** Types the callback must evaluate to; any type when omitted. */
  readonly returns?: TReturnKind | readonly TReturnKind[];
  readonly optional?: boolean;
}

/** A text value narrowed to one of the allowed words. */
export type ChoiceValue<TChoice extends string> = FormulaString & { readonly value: TChoice };

type ValueArgument<TKind extends Kind, TValue extends FormulaDataType, TFlags extends object> = Argument<
  TKind,
  TValue,
  [TFlags] extends [{ readonly optional: true }] ? true : false,
  [TFlags] extends [{ readonly repeatable: true }] ? true : false
>;

function define<TKind extends Kind, TValue extends FormulaDataType, TFlags extends object>(
  types: TKind | TKind[],
  name: string,
  options: ValueArgumentOptions<FormulaDataTypeByKind<TKind>> | undefined,
): ValueArgument<TKind, TValue, TFlags> {
  // `TFlags` carries the literal flags of `options`, which `Argument` itself stores as plain booleans.
  return new Argument<TKind, TValue>(types, { name, ...options }) as ValueArgument<TKind, TValue, TFlags>;
}

function valueOf<TKind extends Kind>(types: TKind | TKind[]) {
  return <const TFlags extends object = Record<never, never>>(
    name: string,
    options?: TFlags & ValueArgumentOptions<FormulaDataTypeByKind<TKind>>,
  ) => define<TKind, FormulaDataTypeByKind<TKind>, TFlags>(types, name, options);
}

/**
 * Argument definitions for routine signatures, typed so that the handler receives matching values.
 *
 * @example
 * ```ts
 * routinesRegistry.registerRoutine('replace', {
 *   arguments: [arg.string('text'), arg.pattern('pattern'), arg.string('replacement')],
 *   handler: ({ subject, args: [pattern, replacement] }) => …, // pattern: FormulaString | FormulaRegExp
 * });
 * ```
 */
export const arg = {
  any: valueOf(Kind.Any),
  array: valueOf(Kind.Array),
  boolean: valueOf(Kind.Boolean),
  dateTime: valueOf(Kind.DateTime),
  dateRange: valueOf(Kind.DateRange),
  duration: valueOf(Kind.Duration),
  number: valueOf(Kind.Number),
  object: valueOf(Kind.Object),
  regexp: valueOf(Kind.RegExp),
  string: valueOf(Kind.String),

  /** Text or a regular expression, for arguments that take a pattern. */
  pattern: valueOf([Kind.String, Kind.RegExp]),

  /** A value of any of the listed types. */
  oneOf: <const TKind extends Kind, const TFlags extends object = Record<never, never>>(
    name: string,
    types: readonly TKind[],
    options?: TFlags & ValueArgumentOptions<FormulaDataTypeByKind<TKind>>,
  ) => define<TKind, FormulaDataTypeByKind<TKind>, TFlags>([...types], name, options),

  /**
   * Text that must be one of the listed words, such as a unit name.
   *
   * @remarks
   * Any other text fails with `Expected "a", "b".` pointing at the argument.
   */
  choice: <const TChoice extends string, const TFlags extends ArgumentFlags = Record<never, never>>(
    name: string,
    choices: readonly TChoice[],
    options?: TFlags,
  ) => define<typeof Kind.String, ChoiceValue<TChoice>, TFlags>(Kind.String, name, {
    ...options,
    validation: (dataType) => {
      if ((choices as readonly string[]).includes(dataType.value)) {
        return undefined;
      }

      return {
        message: `Expected ${choices.map((choice) => `"${choice}"`).join(', ')}.`,
        expected: choices,
      };
    },
  }),

  /** An expression the routine evaluates itself, with `variables` in scope, such as the condition of `filter`. */
  callback: <const TVariables extends string, const TReturnKind extends Kind = typeof Kind.Any>(
    name: string,
    options: CallbackOptions<TVariables, TReturnKind>,
  ): CallbackArgument<TVariables, FormulaDataTypeByKind<TReturnKind>> => new CallbackArgument(options.variables, {
    name,
    optional: options.optional,
    returnType: Array.isArray(options.returns) ? [...options.returns] : options.returns,
  }),

  /**
   * An expression evaluated for each item of a list, with the item as `current` and its position as `index`.
   *
   * @remarks
   * The variable names are fixed so that every list routine reads the same way, as in `filter(list, current > 3)`.
   */
  eachItem: <const TReturnKind extends Kind = typeof Kind.Any>(
    name: string,
    options?: Omit<CallbackOptions<never, TReturnKind>, 'variables'>,
  ) => arg.callback(name, { ...options, variables: ['current', 'index'] }),
} as const;
