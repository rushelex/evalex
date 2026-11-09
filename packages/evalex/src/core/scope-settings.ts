import type { FormulaScope } from './formula-scope';
import type { ValueFormat } from './value-format';

/**
 * The format and the time zone of each scope, for the language service, which evaluates parts of formulas with them.
 * A map outside the class keeps them off the public surface of `FormulaScope`.
 */
export const scopeSettings = new WeakMap<FormulaScope, { readonly format: ValueFormat | undefined; readonly timeZone: string }>();
