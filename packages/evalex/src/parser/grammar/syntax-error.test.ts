import { syntaxErrorOf } from '../../testing-library/syntax-error-of';
import { SyntaxError } from './syntax-error';
import { SyntaxErrorCode } from './syntax-error-code';

const CASES = [
  { formula: '1 2', code: 'EXPECTED_END_OF_INPUT', payload: { found: '2' } },
  { formula: 'a ? b', code: 'MISSING_TOKEN', payload: { expected: [':'] } },
  { formula: '(1', code: 'MISSING_TOKEN', payload: { expected: [')'] } },
  { formula: '[1', code: 'MISSING_TOKEN', payload: { expected: [']'] } },
  { formula: 'let x = 1 2', code: 'MISSING_TOKEN', payload: { expected: [',', 'in'] } },
  { formula: 'f(1', code: 'UNCLOSED_PARENTHESIS', payload: {} },
  { formula: 'let x 1', code: 'MISSING_EQUALS', payload: { name: 'x' } },
  { formula: 'const x = 1', code: 'RESERVED_CONST', payload: {} },
  { formula: 'let x = 1, 2 in x', code: 'EXPECTED_VARIABLE_NAME', payload: {} },
  { formula: 'let true = 1 in 1', code: 'RESERVED_VARIABLE_NAME', payload: { name: 'true' } },
  { formula: 'let x = 1, x = 2 in x', code: 'DUPLICATE_VARIABLE', payload: { name: 'x' } },
  { formula: 'let x = x in x', code: 'VARIABLE_USED_BEFORE_DECLARATION', payload: { name: 'x' } },
  { formula: 'let x = 1 in x in y', code: 'BARE_IN_AFTER_LET', payload: {} },
  { formula: 'a.b', code: 'UNCALLED_METHOD', payload: { name: 'b' } },
  { formula: '(1)(2)', code: 'UNCALLABLE_EXPRESSION', payload: {} },
  { formula: '-', code: 'EXPECTED_EXPRESSION', payload: {} },
  { formula: '@', code: 'UNEXPECTED_CHARACTER', payload: { character: '@' } },
  { formula: 'and', code: 'UNEXPECTED_KEYWORD', payload: { keyword: 'and' } },
  { formula: 'a.', code: 'EXPECTED_METHOD_NAME', payload: {} },
  { formula: 'a.and()', code: 'KEYWORD_AS_METHOD_NAME', payload: { keyword: 'and' } },
  { formula: '()', code: 'EMPTY_PARENTHESES', payload: {} },
  { formula: 'f(, 1)', code: 'LEADING_COMMA', payload: {} },
  { formula: 'f(1, )', code: 'MISSING_ARGUMENT', payload: {} },
  { formula: '"abc', code: 'UNTERMINATED_STRING', payload: {} },
  { formula: '"\\xZ1"', code: 'INVALID_HEX_ESCAPE', payload: {} },
  { formula: '"\\u12"', code: 'INVALID_UNICODE_ESCAPE', payload: {} },
  { formula: '"\\01"', code: 'ZERO_ESCAPE_BEFORE_DIGIT', payload: {} },
  { formula: '"\\1"', code: 'DIGIT_ESCAPE', payload: { digit: '1' } },
  { formula: '/a', code: 'UNTERMINATED_REGEXP', payload: {} },
  { formula: '//', code: 'EMPTY_REGEXP', payload: {} },
  { formula: '/a/gg', code: 'INVALID_REGEXP_FLAGS', payload: { flags: 'gg' } },
  { formula: '/(/', code: 'INVALID_REGEXP', payload: { reason: engineRegExpError('(') } },
  { formula: `${'('.repeat(257)}1${')'.repeat(257)}`, code: 'TOO_DEEP', payload: { limit: 256 } },
] as const;

describe(SyntaxError, () => {
  it.each(CASES)('should name the error of $formula with its code and payload', ({ formula, code, payload }) => {
    expect(syntaxErrorOf(formula)).toMatchObject({ code, payload });
  });

  it.each(CASES)('should give the error of $formula the message key of its code', ({ formula, code }) => {
    expect(syntaxErrorOf(formula).messageKey).toBe(`syntax_error.${code.toLowerCase()}`);
  });

  it('should have a formula above for every code', () => {
    expect(new Set(CASES.map(({ code }) => code))).toEqual(new Set(Object.values(SyntaxErrorCode)));
  });

  it('should keep the message of the code, ending with the offsets of the location', () => {
    expect(syntaxErrorOf('a +\n  [1, 2')).toMatchObject({
      code: 'MISSING_TOKEN',
      message: 'Expected "]". [11,11]',
      location: { start: { offset: 11, line: 2, column: 8 }, end: { offset: 11, line: 2, column: 8 } },
    });
  });
});

/** The message the JavaScript engine gives for `pattern`, which differs between engines. */
function engineRegExpError(pattern: string): string {
  try {
    void new RegExp(pattern);
  }
  catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
  }

  throw new Error(`Expected /${pattern}/ to be invalid.`);
}
