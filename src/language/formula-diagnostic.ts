import type { FormulaErrorCode } from '../core/errors/error-codes';
import type { FormulaErrorPayloads } from '../core/errors/error-payloads';
import type { FormulaLocation } from '../parser/ast/location';
import type { SyntaxErrorCode } from '../parser/grammar/syntax-error-code';
import type { SyntaxErrorPayloads } from '../parser/grammar/syntax-error-payloads';
import type { FormulaCompletions } from './formula-completions';

/**
 * A problem in formula text that an editor underlines, with the message to show next to it.
 *
 * @remarks
 * A plain object, so it survives being posted to and from a worker. `code` and `payload` are those of the
 * `SyntaxError` or the `FormulaError` the formula throws, so a host translates them the same way.
 */
export interface FormulaDiagnostic<C extends SyntaxErrorCode | FormulaErrorCode = SyntaxErrorCode | FormulaErrorCode> {
  readonly code: C;
  /** What the message fills in, such as the unexpected character or the name that is not defined. */
  readonly payload: (SyntaxErrorPayloads & FormulaErrorPayloads)[C];
  /** The English message, without the offsets an error message ends with. */
  readonly message: string;
  /** For a `FormulaError`, the key of its message, which tells apart the errors that share a `code`. */
  readonly messageKey?: string;
  /** The part of the formula to underline. */
  readonly location: FormulaLocation;
  /**
   * For a name the formula cannot read, the names spelled like it that can stand there, closest first, and the span of
   * the name they replace; absent when none is close.
   */
  readonly suggestions?: FormulaCompletions;
}
