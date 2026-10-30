import type { FormulaLocation } from '../../parser';

import type { FormulaErrorCode } from './error-codes';
import type { FormulaErrorPayloads } from './error-payloads';

export interface FormulaErrorOptions {
  location?: FormulaLocation;
  messageKey: string;
  messageParams?: Record<string, unknown>;
  cause?: Error;
}

/**
 * Thrown, or held in a formula cell, when a formula cannot be evaluated: a missing name, a wrong argument, a division by
 * zero and the like.
 *
 * @remarks
 * Everything formula text can cause fails with a `FormulaError` or a `SyntaxError`; any other error is a bug. Several
 * errors share a `code`; `Errors.<Group>.<Error>.is(error)` tells one of them apart.
 *
 * @example
 * ```ts
 * try {
 *   scope.evaluate('price * qty', { price: 10 });
 * }
 * catch (error) {
 *   if (error instanceof FormulaError) {
 *     error.code;     // 'REFERENCE_ERROR'
 *     error.location; // points at `qty`
 *   }
 * }
 * ```
 */
export class FormulaError<C extends FormulaErrorCode = FormulaErrorCode> extends Error {
  /** The group of the error, which decides the shape of `payload`. */
  readonly code: C;
  /** Machine-readable details of the error, such as the missing name or the expected types. */
  readonly payload: FormulaErrorPayloads[C];
  /** The part of the formula at fault; an error a formula cell gets from a failed input points at the read. */
  readonly location?: FormulaLocation;
  /** The key of the message for a host that shows errors in its own language, such as `formula_error.division_by_zero`. */
  readonly messageKey: string;
  /** The values the localized message fills in. */
  readonly messageParams?: Record<string, unknown>;

  constructor(
    code: C,
    message: string,
    payload: FormulaErrorPayloads[C],
    options: FormulaErrorOptions,
  ) {
    const formattedMessage = message.endsWith('.') ? message : `${message}.`;
    const hasMessageLocation = /\[\d+,\d+\]$/.test(message);
    const messageWithLocation = hasMessageLocation
      ? formattedMessage
      : `${formattedMessage}${options.location ? ` [${options.location.start.offset},${options.location.end.offset}]` : ''}`;

    super(messageWithLocation, options.cause ? { cause: options.cause } : undefined);

    this.name = 'FormulaError';
    this.code = code;
    this.payload = payload;
    this.location = options.location;
    this.messageKey = options.messageKey;
    this.messageParams = options.messageParams;
  }
}
