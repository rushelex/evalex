import type { FormulaArray, FormulaDataType, FormulaString } from '../../data-types';
import type { ValueType } from '../../types';
import type { ArgumentValidationFailure } from './argument';

import { type } from '../../types';
import { Argument } from './argument';
import { CallbackArgument } from './callback-argument';

interface ArgumentFlags {
  readonly optional?: boolean;
  readonly repeatable?: boolean;
}

interface ValueArgumentOptions<TValue extends FormulaDataType> extends ArgumentFlags {
  readonly validation?: (dataType: TValue) => ArgumentValidationFailure | undefined;
}

interface CallbackOptions<TVariables extends string, TReturn extends FormulaDataType> {
  /** Variables the routine puts in scope for each evaluation, such as `current` and `index`. */
  readonly variables: readonly TVariables[];
  /** The type each evaluation must return; any type when omitted. */
  readonly returns?: ValueType<TReturn>;
  readonly optional?: boolean;
}

/** A text value narrowed to one of the allowed words. */
export type ChoiceValue<TChoice extends string> = FormulaString & { readonly value: TChoice };

/** What a call guarantees of a value of a type: its kind, while the items of a list are left to the routine. */
type Checked<TValue extends FormulaDataType> = TValue extends FormulaArray<FormulaDataType> ? FormulaArray<FormulaDataType> : TValue;

type ValueArgument<TValue extends FormulaDataType, TFlags extends object> = Argument<
  TValue,
  [TFlags] extends [{ readonly optional: true }] ? true : false,
  [TFlags] extends [{ readonly repeatable: true }] ? true : false
>;

/** An argument that takes values of `valueType`. */
function value<TValue extends FormulaDataType, const TFlags extends object = Record<never, never>>(
  name: string,
  valueType: ValueType<TValue>,
  options?: TFlags & ValueArgumentOptions<Checked<TValue>>,
): ValueArgument<Checked<TValue>, TFlags> {
  // `TFlags` carries the literal flags of `options`, which `Argument` itself stores as plain booleans.
  return new Argument<Checked<TValue>>(valueType, name, options) as ValueArgument<Checked<TValue>, TFlags>;
}

function shorthand<TValue extends FormulaDataType>(valueType: ValueType<TValue>) {
  return <const TFlags extends object = Record<never, never>>(
    name: string,
    options?: TFlags & ValueArgumentOptions<Checked<TValue>>,
  ) => value(name, valueType, options);
}

/**
 * Argument definitions for routine signatures, typed so that the handler receives matching values.
 *
 * @remarks
 * `arg(name, type)` takes values of a type built with `type`; `arg.number(name)` and the like are shorthands for it.
 *
 * @example
 * ```ts
 * routinesRegistry.registerRoutine('replace', {
 *   arguments: [arg.string('text'), arg.pattern('pattern'), arg('replacement', type.string)],
 *   handler: ({ subject, args: [pattern, replacement] }) => …, // pattern: FormulaString | FormulaRegExp
 * });
 * ```
 */
export const arg = Object.assign(value, {
  any: shorthand(type.any),
  array: shorthand(type.array(type.any)),
  boolean: shorthand(type.boolean),
  date: shorthand(type.date),
  dateTime: shorthand(type.dateTime),
  dateRange: shorthand(type.dateRange),
  duration: shorthand(type.duration),
  number: shorthand(type.number),
  object: shorthand(type.object),
  regexp: shorthand(type.regexp),
  string: shorthand(type.string),

  /** Text or a regular expression, for arguments that take a pattern. */
  pattern: shorthand(type.union(type.string, type.regexp)),

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
  ): ValueArgument<ChoiceValue<TChoice>, TFlags> => new Argument<ChoiceValue<TChoice>>(type.string, name, {
    ...options,
    choices,
    validation: (dataType) => {
      if ((choices as readonly string[]).includes(dataType.value)) {
        return undefined;
      }

      return {
        message: `Expected ${choices.map((choice) => `"${choice}"`).join(', ')}.`,
        expected: choices,
      };
    },
  }) as ValueArgument<ChoiceValue<TChoice>, TFlags>,

  /** An expression the routine evaluates itself, with `variables` in scope, such as the condition of `filter`. */
  callback: <const TVariables extends string, TReturn extends FormulaDataType = FormulaDataType>(
    name: string,
    options: CallbackOptions<TVariables, TReturn>,
  ): CallbackArgument<TVariables, Checked<TReturn>> => new CallbackArgument(options.variables, name, {
    optional: options.optional,
    returns: options.returns,
  }),

  /**
   * An expression evaluated for each item of a list, with the item as `current` and its position as `index`.
   *
   * @remarks
   * The variable names are fixed so that every list routine reads the same way, as in `filter(list, current > 3)`.
   */
  eachItem: <TReturn extends FormulaDataType = FormulaDataType>(
    name: string,
    options?: Omit<CallbackOptions<never, TReturn>, 'variables'>,
  ) => arg.callback(name, { ...options, variables: ['current', 'index'] }),
});
