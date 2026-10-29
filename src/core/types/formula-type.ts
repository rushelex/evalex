import type { Kind } from '../data-types';

/**
 * Describes the values an expression can have, such as what a routine returns: a kind, a list of a type, or one of
 * several types.
 *
 * @remarks
 * Plain data, so a host can keep it, send it and show it, as in "a list of numbers" for an `Array` of `Number`.
 * `Any` stands for a value of any type. A `Variable` appears only in the signatures of routines and stands for the same
 * type wherever its name repeats, as `T` in `first(list: Array<T>): T`.
 *
 * @example
 * ```ts
 * const numbers: FormulaType = { kind: 'Array', items: { kind: 'Number' } };
 * const numberOrText: FormulaType = { kind: 'Union', of: [{ kind: 'Number' }, { kind: 'String' }] };
 * ```
 */
export type FormulaType
  = | { readonly kind: Exclude<Kind, typeof Kind.Array> }
    | { readonly kind: typeof Kind.Array; readonly items: FormulaType }
    | { readonly kind: 'Union'; readonly of: readonly FormulaType[] }
    | { readonly kind: 'Variable'; readonly name: string };
