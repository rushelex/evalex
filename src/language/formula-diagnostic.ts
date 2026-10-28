import type { FormulaLocation } from '../parser/ast/location';
import type { SyntaxErrorCode } from '../parser/grammar/syntax-error-code';
import type { SyntaxErrorPayloads } from '../parser/grammar/syntax-error-payloads';

/**
 * A problem in formula text that an editor underlines, with the message to show next to it.
 *
 * @remarks
 * A plain object, so it survives being posted to and from a worker. `code` and `payload` are those of the
 * `SyntaxError` the formula throws, so a host translates both the same way.
 */
export interface FormulaDiagnostic<C extends SyntaxErrorCode = SyntaxErrorCode> {
  readonly code: C;
  /** What the message fills in, such as the unexpected character. */
  readonly payload: SyntaxErrorPayloads[C];
  /** The English message, without the offsets a `SyntaxError` message ends with. */
  readonly message: string;
  /** The part of the formula to underline. */
  readonly location: FormulaLocation;
}
