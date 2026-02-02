import type { AST } from '../../parser';

import type { FormulaErrorCode } from './error-codes';
import type { FormulaErrorPayloads } from './error-payloads';

export interface FormulaErrorOptions {
  location?: AST.Location;
  messageKey?: string;
  messageParams?: Record<string, unknown>;
  cause?: Error;
}

export class FormulaError<C extends FormulaErrorCode = FormulaErrorCode> extends Error {
  readonly code: C;
  readonly payload: FormulaErrorPayloads[C];
  readonly location?: AST.Location;
  readonly messageKey?: string;
  readonly messageParams?: Record<string, unknown>;

  constructor(
    code: C,
    message: string,
    payload: FormulaErrorPayloads[C],
    options?: FormulaErrorOptions,
  ) {
    const formattedMessage = message.endsWith('.') ? message : `${message}.`;
    const hasMessageLocation = /\[\d+,\d+\]$/.test(message);
    const messageWithLocation = hasMessageLocation
      ? formattedMessage
      : `${formattedMessage}${options?.location ? ` [${options.location.start.offset},${options.location.end.offset}]` : ''}`;

    super(messageWithLocation, options?.cause ? { cause: options.cause } : undefined);

    this.name = 'FormulaError';
    this.code = code;
    this.payload = payload;
    this.location = options?.location;
    this.messageKey = options?.messageKey;
    this.messageParams = options?.messageParams;
  }
}
