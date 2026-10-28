import type { FormulaLocation } from './location';

/**
 * What a piece of formula text is, for highlighting it in an editor.
 *
 * @remarks
 * - `name` — a value or field read by name, such as `price`, `current` or a name declared with `let`
 * - `function` — a name called as a function, such as `round` in `round(x)`
 * - `method` — a name called on a value, such as `total` in `x.total()`
 * - `keyword` — `let` and the `in` that ends its names
 * - `operator` — `+`, `==`, `and`, `not`, both words of `not in`, the `=` of `let`, and the like
 * - `punctuation` — brackets, `,`, `.`, `?` and `:`
 * - `invalid` — text from a syntax error to the end of the formula
 */
export type FormulaTokenKind
  = | 'number'
    | 'string'
    | 'regexp'
    | 'boolean'
    | 'null'
    | 'name'
    | 'function'
    | 'method'
    | 'keyword'
    | 'operator'
    | 'punctuation'
    | 'invalid';

/** A piece of formula text with the kind it has in the formula. */
export interface FormulaToken {
  readonly kind: FormulaTokenKind;
  readonly location: FormulaLocation;
}
