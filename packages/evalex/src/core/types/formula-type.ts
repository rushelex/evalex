import type { Kind } from '../data-types';
import type { FormulaField } from './formula-field';

/**
 * Describes the values an expression can have, such as what a routine returns: a kind, a list of a type, a record of
 * fields, lists of a type nested at any depth, or one of several types.
 *
 * @remarks
 * Plain data, so a host can keep it, send it and show it, as in "a list of numbers" for an `Array` of `Number`.
 * `Any` stands for a value of any type. An `Object` with `fields` is a record that has at least those fields; without
 * them, a record of any fields. A `Nested` type is a value of `items` or a list of such values, at any depth, as
 * `sum` takes numbers and lists of them. A `Variable` appears only in the signatures of routines and stands for the same type
 * wherever its name repeats, as `T` in `first(list: Array<T>): T`.
 *
 * @example
 * ```ts
 * const numbers: FormulaType = { kind: 'Array', items: { kind: 'Number' } };
 * const numberOrText: FormulaType = { kind: 'Union', of: [{ kind: 'Number' }, { kind: 'String' }] };
 * const line: FormulaType = { kind: 'Object', fields: [{ name: 'qty', label: 'Quantity', type: { kind: 'Number' } }] };
 * ```
 */
export type FormulaType
  = | { readonly kind: Exclude<Kind, typeof Kind.Array | typeof Kind.Object> }
    | { readonly kind: typeof Kind.Array; readonly items: FormulaType }
    | { readonly kind: typeof Kind.Object; readonly fields?: readonly FormulaField[] }
    | { readonly kind: 'Nested'; readonly items: FormulaType }
    | { readonly kind: 'Union'; readonly of: readonly FormulaType[] }
    | { readonly kind: 'Variable'; readonly name: string };
