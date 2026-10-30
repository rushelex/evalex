import type { FormulaDiagnostic } from './index';

import { it } from '@fast-check/vitest';

import { FormulaScope } from '../core/formula-scope';
import { parse } from '../parser';
import { SyntaxErrorCode } from '../parser/grammar/syntax-error-code';
import { formulaTextArbitrary, spacedFormulaArbitrary } from '../testing-library/formula-text-arbitrary';
import { isSyntaxError } from '../testing-library/is-syntax-error';
import { FormulaLanguage } from './index';

const language = new FormulaLanguage(new FormulaScope());

const SYNTAX_ERROR_CODES: readonly string[] = Object.values(SyntaxErrorCode);

describe('diagnose: syntax errors', () => {
  it.prop([formulaTextArbitrary])('should start with the error parsing throws, and find no syntax error in text that parses', (text) => {
    expect(syntaxErrorsOf(text)[0]).toEqual(parseFailure(text));
  });

  it.prop([formulaTextArbitrary])('should point every diagnostic inside the text, each one once', (text) => {
    const diagnostics = diagnose(text);

    expect(diagnostics.filter(({ location }) => location.start.offset > location.end.offset || location.end.offset > text.length)).toEqual([]);
    expect(new Set(diagnostics.map(({ message, location }) => `${message} ${location.start.offset} ${location.end.offset}`)).size).toBe(diagnostics.length);
  });

  it.prop([spacedFormulaArbitrary])('should find no syntax error in a well-formed formula', ({ formula }) => {
    expect(syntaxErrorsOf(formula)).toEqual([]);
  });

  it.each([
    { formula: 'f(@, #)', expected: [['UNEXPECTED_CHARACTER', '@'], ['UNEXPECTED_CHARACTER', '#']] },
    { formula: 'f((@), #)', expected: [['UNEXPECTED_CHARACTER', '@'], ['UNEXPECTED_CHARACTER', '#']] },
    { formula: 'f(b + @, c * #)', expected: [['UNEXPECTED_CHARACTER', '@'], ['UNEXPECTED_CHARACTER', '#']] },
    { formula: 'round(price,, 2) + max(1 2)', expected: [['MISSING_ARGUMENT', ','], ['UNCLOSED_PARENTHESIS', '(1']] },
    { formula: '[1 2, (3 4), 5 6]', expected: [['MISSING_TOKEN', ''], ['MISSING_TOKEN', ''], ['MISSING_TOKEN', '']] },
    { formula: 'upper("\\x") + lower("\\u")', expected: [['INVALID_HEX_ESCAPE', '\\x'], ['INVALID_UNICODE_ESCAPE', '\\u']] },
    { formula: 'a.b + c.d', expected: [['UNCALLED_METHOD', '.b'], ['UNCALLED_METHOD', '.d']] },
    { formula: '/a/gg + /(/', expected: [['INVALID_REGEXP_FLAGS', 'gg'], ['INVALID_REGEXP', '/(/']] },
    { formula: 'let x = 1, x = 2 in x.y', expected: [['DUPLICATE_VARIABLE', 'x'], ['UNCALLED_METHOD', '.y']] },
    { formula: 'let true = 1, y = y in a.b', expected: [['RESERVED_VARIABLE_NAME', 'true'], ['VARIABLE_USED_BEFORE_DECLARATION', 'y'], ['UNCALLED_METHOD', '.b']] },
    { formula: 'let a = b, b = 1 in c.d', expected: [['VARIABLE_USED_BEFORE_DECLARATION', 'b'], ['UNCALLED_METHOD', '.d']] },
    { formula: 'let x = 1 in x in y', expected: [['BARE_IN_AFTER_LET', 'in']] },
    { formula: 'a.and() + b.c', expected: [['KEYWORD_AS_METHOD_NAME', 'and'], ['UNCALLED_METHOD', '.c']] },
    { formula: 'f((), , @)', expected: [['EMPTY_PARENTHESES', '()'], ['MISSING_ARGUMENT', ','], ['UNEXPECTED_CHARACTER', '@']] },
    { formula: 'f(, @)', expected: [['LEADING_COMMA', ','], ['UNEXPECTED_CHARACTER', '@']] },
    { formula: '//g + a.b', expected: [['EMPTY_REGEXP', '//'], ['UNCALLED_METHOD', '.b']] },
    { formula: '"\\01\\1"', expected: [['ZERO_ESCAPE_BEFORE_DIGIT', '\\0'], ['DIGIT_ESCAPE', '\\1']] },
    { formula: '(1)(x.y).z() + a.b', expected: [['UNCALLABLE_EXPRESSION', '(1)'], ['UNCALLED_METHOD', '.y'], ['UNCALLED_METHOD', '.b']] },
  ])('should read on past a mistake to the next one: $formula', ({ formula, expected }) => {
    expect(diagnose(formula).map((diagnostic) => [diagnostic.code, textOf(formula, diagnostic)])).toEqual(expected);
  });

  it('should point each diagnostic at its own mistake', () => {
    expect(diagnose('round(price,, 2) + max(1 2)').map(({ code, location }) => [code, location.start.offset])).toEqual([
      ['MISSING_ARGUMENT', 11],
      ['UNCLOSED_PARENTHESIS', 22],
    ]);
  });

  it('should skip a mistake up to the next argument without stopping at a comma in quotes', () => {
    expect(diagnose('f(1 @ "x, y", #)').map(({ code }) => code)).toEqual(['UNCLOSED_PARENTHESIS', 'UNEXPECTED_CHARACTER']);
  });

  it('should not count the levels of a skipped mistake against the rest of the formula', () => {
    const formula = `f(${'-'.repeat(20)}@, ${'('.repeat(250)}1${')'.repeat(250)})`;

    expect(diagnose(formula).map(({ code }) => code)).toEqual(['UNEXPECTED_CHARACTER']);
  });

  it.each([
    { formula: '((', expected: [['EXPECTED_EXPRESSION', {}], ['MISSING_TOKEN', { expected: [')'] }]] },
    { formula: '[(', expected: [['EXPECTED_EXPRESSION', {}], ['MISSING_TOKEN', { expected: [')'] }], ['MISSING_TOKEN', { expected: [']'] }]] },
  ])('should report each kind of bracket left open at the end once: $formula', ({ formula, expected }) => {
    expect(diagnose(formula).map(({ code, payload }) => [code, payload])).toEqual(expected);
  });

  it('should stop at an error outside any bracket, where the rest cannot be told apart from it', () => {
    expect(diagnose('1 2 @ #').map(({ code }) => code)).toEqual(['EXPECTED_END_OF_INPUT']);
  });

  it('should give the message without offsets, with the payload it fills in', () => {
    expect(diagnose('max(1, @)')).toEqual([{
      code: 'UNEXPECTED_CHARACTER',
      payload: { character: '@' },
      message: 'Unexpected character "@".',
      messageKey: 'syntax_error.unexpected_character',
      location: { start: { offset: 7, line: 1, column: 8 }, end: { offset: 8, line: 1, column: 9 } },
    }]);
  });

  it('should find nothing in empty or blank text', () => {
    expect([diagnose(''), diagnose(' \n ')]).toEqual([[], []]);
  });
});

function diagnose(text: string): FormulaDiagnostic[] {
  return language.diagnose(text);
}

function syntaxErrorsOf(text: string): FormulaDiagnostic[] {
  return diagnose(text).filter(({ code }) => SYNTAX_ERROR_CODES.includes(code));
}

/** The diagnostic for the error parsing `text` throws, or `undefined` when it parses. */
function parseFailure(text: string): FormulaDiagnostic | undefined {
  try {
    parse(text);

    return undefined;
  }
  catch (error) {
    if (!isSyntaxError(error)) {
      throw error;
    }

    const { code, payload, location, message, messageKey } = error;

    return { code, payload, location, message: message.replace(/ \[\d+,\d+\]$/, ''), messageKey };
  }
}

function textOf(formula: string, { location }: FormulaDiagnostic): string {
  return formula.slice(location.start.offset, location.end.offset);
}
