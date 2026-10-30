import type { FormulaLocation } from '../ast/location';
import type { SyntaxErrorCode } from './syntax-error-code';
import type { SyntaxErrorPayloads } from './syntax-error-payloads';

import { SYNTAX_ERROR_MESSAGES } from './syntax-error-messages';

/**
 * Thrown, or held in a formula cell, when formula text cannot be read as a formula; `location` points at the smallest
 * part that explains why.
 *
 * @remarks
 * `code` names the error and `payload` holds what its message fills in, so a host can show the error in its own
 * language by `messageKey`, as it shows a `FormulaError`. The English `message` ends with the offsets of `location`, as
 * `[start,end]`.
 */
export class SyntaxError<C extends SyntaxErrorCode = SyntaxErrorCode> extends globalThis.SyntaxError {
  /** What is wrong with the text, which decides the shape of `payload`. */
  readonly code: C;
  /** What the message fills in, such as the unexpected character. */
  readonly payload: SyntaxErrorPayloads[C];
  /** The key of the message, `syntax_error.` and the code in lower case, such as `syntax_error.missing_argument`. */
  readonly messageKey: string;
  readonly location: FormulaLocation;

  constructor(code: C, payload: SyntaxErrorPayloads[C], location: FormulaLocation) {
    super(`${SYNTAX_ERROR_MESSAGES[code](payload)} [${location.start.offset},${location.end.offset}]`);
    this.name = 'SyntaxError';
    this.code = code;
    this.payload = payload;
    this.messageKey = `syntax_error.${code.toLowerCase()}`;
    this.location = location;
  }
}
