import type { FormulaArray, FormulaDataType, FormulaDataTypeByKind } from '../data-types';
import type { FormulaType } from './formula-type';
import type { ValueType } from './value-type';

import { Kind } from '../data-types';

function describe<TValue extends FormulaDataType>(formulaType: FormulaType): ValueType<TValue> {
  // The class of the values is for the compiler alone, so the data carries none
  return formulaType as ValueType<TValue>;
}

function kind<TKind extends Exclude<Kind, typeof Kind.Array>>(name: TKind): ValueType<FormulaDataTypeByKind<TKind>> {
  return describe({ kind: name });
}

/**
 * Builds the types routines declare, typed with the classes of the values they describe.
 *
 * @example
 * ```ts
 * routinesRegistry.registerRoutine('split', {
 *   arguments: [arg.string('text'), arg.pattern('separator')],
 *   returns: type.array(type.string), // fails to compile when the handler may return anything but FormulaArray<FormulaString>
 *   handler: …,
 * });
 * ```
 */
export const type = {
  any: kind(Kind.Any),
  boolean: kind(Kind.Boolean),
  date: kind(Kind.Date),
  dateRange: kind(Kind.DateRange),
  dateTime: kind(Kind.DateTime),
  duration: kind(Kind.Duration),
  null: kind(Kind.Null),
  number: kind(Kind.Number),
  object: kind(Kind.Object),
  regexp: kind(Kind.RegExp),
  string: kind(Kind.String),

  /** A list whose items are all of `items`. */
  array: <TItem extends FormulaDataType>(items: ValueType<TItem>): ValueType<FormulaArray<TItem>> => describe({ kind: Kind.Array, items }),

  /** A value of any of the types. */
  union: <const TValues extends readonly FormulaDataType[]>(...of: { readonly [K in keyof TValues]: ValueType<TValues[K]> }): ValueType<TValues[number]> => describe({ kind: 'Union', of }),
} as const;
