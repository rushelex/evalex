/**
 * Key of the full double inside a `FormulaNumber`, read only by arithmetic.
 * It is not exported from the package, so hosts see only the 15-digit `value`.
 */
export const exactValue: unique symbol = Symbol('exactValue');
