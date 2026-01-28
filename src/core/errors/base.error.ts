import type { AST } from '../../parser';

export interface FormulaErrorContext {
  [key: string]: unknown;
}

export interface FormulaErrorOptions<TContext extends FormulaErrorContext = FormulaErrorContext> {
  cause?: unknown;
  context: TContext;
  location?: AST.Location;
}

export class FormulaError<TContext extends FormulaErrorContext = FormulaErrorContext> extends Error {
  readonly rawMessage: string;
  readonly context: TContext;
  readonly location?: AST.Location;

  constructor(
    message: string,
    options: FormulaErrorOptions<TContext>,
  ) {
    const { context, location, cause } = options;

    const formattedMessage = message.endsWith('.') ? message : `${message}.`;
    const hasMessageLocation = /\[\d+,\d+\]$/.test(message);
    const messageWithLocation = hasMessageLocation
      ? formattedMessage
      : `${formattedMessage}${location ? ` [${location.start.offset},${location.end.offset}]` : ''}`;

    super(messageWithLocation, cause ? { cause } : undefined);

    this.name = 'FormulaError';
    this.rawMessage = message;
    this.context = context;
    this.location = location;
  }
}
