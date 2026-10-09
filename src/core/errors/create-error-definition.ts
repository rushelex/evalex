import type { AST } from '../../parser';

import type { FormulaErrorCode } from './error-codes';
import type { FormulaErrorPayloads } from './error-payloads';

import { FormulaError } from './formula-error';

export interface ErrorDefinitionConfig<
  TCode extends FormulaErrorCode,
  TArgs extends unknown[],
> {
  code: TCode;
  createPayload: (...args: TArgs) => FormulaErrorPayloads[TCode];
  formatMessage: (payload: FormulaErrorPayloads[TCode]) => string;
  messageKey?: string;
}

interface CreateOptions {
  location?: AST.Location;
  cause?: Error;
}

export interface ErrorDefinition<
  TCode extends FormulaErrorCode,
  TArgs extends unknown[],
> {
  readonly code: TCode;
  create: (...args: [...TArgs, options?: CreateOptions]) => FormulaError<TCode>;

  /**
   * Returns `true` only for an error created by this definition.
   *
   * @remarks
   * Other definitions may share the same `code`; to match all of them, compare `error.code` instead.
   */
  is: (error: unknown) => error is FormulaError<TCode>;
}

export function createErrorDefinition<
  TCode extends FormulaErrorCode,
  TArgs extends unknown[],
>(
  config: ErrorDefinitionConfig<TCode, TArgs>,
): ErrorDefinition<TCode, TArgs> {
  return {
    code: config.code,

    create: (
      ...args: [...TArgs, options?: CreateOptions]
    ): FormulaError<TCode> => {
      const { payloadArgs, options } = parseArgs<TArgs>(args);
      const payload = config.createPayload(...payloadArgs);
      const message = config.formatMessage(payload);

      return new FormulaError(
        config.code,
        message,
        payload,
        {
          location: options?.location,
          cause: options?.cause,
          messageKey: config.messageKey,
          messageParams: payload as Record<string, unknown>,
        },
      );
    },

    is: (error: unknown): error is FormulaError<TCode> => {
      return error instanceof FormulaError && error.code === config.code && error.messageKey === config.messageKey;
    },
  };
}

function parseArgs<TArgs extends unknown[]>(args: unknown[]): {
  payloadArgs: TArgs;
  options?: CreateOptions;
} {
  if (args.length === 0) {
    return { payloadArgs: [] as unknown as TArgs };
  }

  const lastArg = args.at(-1);

  // Check if the last argument is options object (has location or cause)
  if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg)) {
    const maybeOptions = lastArg as Record<string, unknown>;

    // Check for location property (has start and end with offsets)
    const hasLocation = maybeOptions.location !== undefined
      || (maybeOptions.start !== undefined && maybeOptions.end !== undefined);

    // Check for cause property
    const hasCause = maybeOptions.cause instanceof Error;

    if (hasLocation || hasCause) {
      // If it has location as nested object, extract it
      if (maybeOptions.location !== undefined || hasCause) {
        return {
          payloadArgs: args.slice(0, -1) as TArgs,
          options: maybeOptions,
        };
      }

      // If location is at top level (has start/end directly), it's AST.Location
      if (maybeOptions.start !== undefined && maybeOptions.end !== undefined) {
        return {
          payloadArgs: args.slice(0, -1) as TArgs,
          options: { location: maybeOptions as unknown as AST.Location },
        };
      }
    }
  }

  return { payloadArgs: args as TArgs };
}
