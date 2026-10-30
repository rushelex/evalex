import type { SyntaxErrorCode } from './syntax-error-code';

// A code whose message has nothing to fill in
type NoDetails = Readonly<Record<string, never>>;

/**
 * The `payload` a `SyntaxError` carries for each code: what its message fills in.
 *
 * @example
 * ```ts
 * function describe(payload: SyntaxErrorPayloads['UNEXPECTED_CHARACTER']): string {
 *   return `The character ${payload.character} cannot be used here`;
 * }
 * ```
 */
export interface SyntaxErrorPayloads {
  [SyntaxErrorCode.EXPECTED_END_OF_INPUT]: { readonly found: string };
  /** `expected` lists the alternatives, such as `[",", "in"]` after a `let` value. */
  [SyntaxErrorCode.MISSING_TOKEN]: { readonly expected: readonly string[] };
  [SyntaxErrorCode.UNCLOSED_PARENTHESIS]: NoDetails;
  [SyntaxErrorCode.MISSING_EQUALS]: { readonly name: string };
  [SyntaxErrorCode.RESERVED_CONST]: NoDetails;
  [SyntaxErrorCode.EXPECTED_VARIABLE_NAME]: NoDetails;
  [SyntaxErrorCode.RESERVED_VARIABLE_NAME]: { readonly name: string };
  [SyntaxErrorCode.DUPLICATE_VARIABLE]: { readonly name: string };
  [SyntaxErrorCode.VARIABLE_USED_BEFORE_DECLARATION]: { readonly name: string };
  [SyntaxErrorCode.BARE_IN_AFTER_LET]: NoDetails;
  [SyntaxErrorCode.UNCALLED_METHOD]: { readonly name: string };
  [SyntaxErrorCode.UNCALLABLE_EXPRESSION]: NoDetails;
  [SyntaxErrorCode.EXPECTED_EXPRESSION]: NoDetails;
  [SyntaxErrorCode.UNEXPECTED_CHARACTER]: { readonly character: string };
  [SyntaxErrorCode.UNEXPECTED_KEYWORD]: { readonly keyword: string };
  [SyntaxErrorCode.EXPECTED_METHOD_NAME]: NoDetails;
  [SyntaxErrorCode.KEYWORD_AS_METHOD_NAME]: { readonly keyword: string };
  [SyntaxErrorCode.EMPTY_PARENTHESES]: NoDetails;
  [SyntaxErrorCode.LEADING_COMMA]: NoDetails;
  [SyntaxErrorCode.MISSING_ARGUMENT]: NoDetails;
  [SyntaxErrorCode.UNTERMINATED_STRING]: NoDetails;
  [SyntaxErrorCode.INVALID_HEX_ESCAPE]: NoDetails;
  [SyntaxErrorCode.INVALID_UNICODE_ESCAPE]: NoDetails;
  [SyntaxErrorCode.ZERO_ESCAPE_BEFORE_DIGIT]: NoDetails;
  [SyntaxErrorCode.DIGIT_ESCAPE]: { readonly digit: string };
  [SyntaxErrorCode.UNTERMINATED_REGEXP]: NoDetails;
  [SyntaxErrorCode.EMPTY_REGEXP]: NoDetails;
  [SyntaxErrorCode.INVALID_REGEXP_FLAGS]: { readonly flags: string };
  /** `reason` is the JavaScript engine's own message, so it differs between engines and is not translated. */
  [SyntaxErrorCode.INVALID_REGEXP]: { readonly reason: string };
  [SyntaxErrorCode.TOO_DEEP]: { readonly limit: number };
}
