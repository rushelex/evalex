/**
 * Names every way formula text can fail to be a formula: the `code` of every `SyntaxError` is one of them, and
 * `SyntaxErrorPayloads` gives the payload of each.
 *
 * @remarks
 * Each code has one message, filled in from its payload, so a host can show syntax errors in its own language by code.
 *
 * @example
 * ```ts
 * if (error.code === SyntaxErrorCode.UNEXPECTED_CHARACTER) {
 *   // a character no formula can contain, such as `@`
 * }
 * ```
 */
export const SyntaxErrorCode = {
  /** `Expected end of input but "x" found.`: a whole formula is followed by more text. */
  EXPECTED_END_OF_INPUT: 'EXPECTED_END_OF_INPUT',
  /** `Expected ")".`: a bracket, `:` of a conditional, or `,`/`in` of a `let` is missing. */
  MISSING_TOKEN: 'MISSING_TOKEN',
  /** `Expected token ")".`: a call is not closed; the location spans the call from its `(`. */
  UNCLOSED_PARENTHESIS: 'UNCLOSED_PARENTHESIS',
  /** `Expected "=" after "x".`: a `let` name has no value. */
  MISSING_EQUALS: 'MISSING_EQUALS',
  /** `"const" is reserved; declare names with "let".` */
  RESERVED_CONST: 'RESERVED_CONST',
  /** `Expected a variable name.`: `let` or a `,` between its names is not followed by a name. */
  EXPECTED_VARIABLE_NAME: 'EXPECTED_VARIABLE_NAME',
  /** `"x" cannot be a variable name.`: a `let` declares a keyword. */
  RESERVED_VARIABLE_NAME: 'RESERVED_VARIABLE_NAME',
  /** `Variable "x" is already declared in this "let".` */
  DUPLICATE_VARIABLE: 'DUPLICATE_VARIABLE',
  /** `Variable "x" is used before its declaration.`: a `let` value reads its own name or a later one. */
  VARIABLE_USED_BEFORE_DECLARATION: 'VARIABLE_USED_BEFORE_DECLARATION',
  /** `Put "in" inside a "let" body in parentheses: "(a in b)".` */
  BARE_IN_AFTER_LET: 'BARE_IN_AFTER_LET',
  /** `Expected function 'x()' to be called.`: a member is read without calling it. */
  UNCALLED_METHOD: 'UNCALLED_METHOD',
  /** `Expected expression.`: the text ends where an operand should be. */
  EXPECTED_EXPRESSION: 'EXPECTED_EXPRESSION',
  /** `Unexpected character "x".` */
  UNEXPECTED_CHARACTER: 'UNEXPECTED_CHARACTER',
  /** `Unexpected keyword "x".`: an operator word such as `and` stands where an operand should be. */
  UNEXPECTED_KEYWORD: 'UNEXPECTED_KEYWORD',
  /** `Expected identifier.`: a `.` is not followed by a method name. */
  EXPECTED_METHOD_NAME: 'EXPECTED_METHOD_NAME',
  /** `Expected identifier but found keyword "x".`: a `.` is followed by a keyword. */
  KEYWORD_AS_METHOD_NAME: 'KEYWORD_AS_METHOD_NAME',
  /** `Empty parentheses "()" are not a valid expression.` */
  EMPTY_PARENTHESES: 'EMPTY_PARENTHESES',
  /** `Arguments cannot start with a comma.` */
  LEADING_COMMA: 'LEADING_COMMA',
  /** `Unexpected comma or missing argument in function call.` */
  MISSING_ARGUMENT: 'MISSING_ARGUMENT',
  /** `Unterminated string.` */
  UNTERMINATED_STRING: 'UNTERMINATED_STRING',
  /** `Invalid hexadecimal escape sequence.` */
  INVALID_HEX_ESCAPE: 'INVALID_HEX_ESCAPE',
  /** `Invalid Unicode escape sequence.` */
  INVALID_UNICODE_ESCAPE: 'INVALID_UNICODE_ESCAPE',
  /** `Escape sequence \0 is not allowed before a digit; …` */
  ZERO_ESCAPE_BEFORE_DIGIT: 'ZERO_ESCAPE_BEFORE_DIGIT',
  /** `Escape sequence \1 is not allowed; …`: a backslash before a digit from 1 to 9. */
  DIGIT_ESCAPE: 'DIGIT_ESCAPE',
  /** `Unterminated regular expression.` */
  UNTERMINATED_REGEXP: 'UNTERMINATED_REGEXP',
  /** `Empty regular expression.` */
  EMPTY_REGEXP: 'EMPTY_REGEXP',
  /** `Invalid regular expression flags "x".` */
  INVALID_REGEXP_FLAGS: 'INVALID_REGEXP_FLAGS',
  /** A pattern the JavaScript engine rejects; the message is the engine's, in English. */
  INVALID_REGEXP: 'INVALID_REGEXP',
  /** `Nested or chained more than 256 levels deep.` */
  TOO_DEEP: 'TOO_DEEP',
} as const;

// eslint-disable-next-line ts/no-redeclare -- a value and a type under one name, the way an enum reads
export type SyntaxErrorCode = (typeof SyntaxErrorCode)[keyof typeof SyntaxErrorCode];
