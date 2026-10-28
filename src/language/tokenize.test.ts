import type { FormulaToken } from './index';

import { it } from '@fast-check/vitest';

import { parse } from '../parser';
import { SyntaxError } from '../parser/grammar/syntax-error';
import { formulaTextArbitrary, spacedFormulaArbitrary } from '../testing-library/formula-text-arbitrary';
import { tokenize } from './index';

describe(tokenize, () => {
  it.prop([formulaTextArbitrary])('should cover any text with tokens in order, leaving only whitespace between them', (text) => {
    expect(coverageProblems(text, tokenize(text))).toEqual([]);
  });

  it.prop([formulaTextArbitrary])('should mark text invalid up to its end from no later than where the formula fails to parse', (text) => {
    const failure = failureStart(text) ?? text.length;
    const { start, end } = tokenize(text).find((token) => token.kind === 'invalid')?.location
      ?? { start: { offset: text.length }, end: { offset: text.length } };

    expect(start.offset).toBeLessThanOrEqual(failure);
    expect(end.offset).toBeGreaterThan(Math.min(failure, text.length - 1));
  });

  it.prop([spacedFormulaArbitrary])('should give each token of a well-formed formula its text and kind', ({ tokens, formula }) => {
    expect(tokenize(formula).map((token) => ({ text: textOf(formula, token), kind: token.kind }))).toEqual(tokens);
  });

  it('should tell names, functions and methods apart', () => {
    expect(kinds('round(price, 2) + x.total()')).toEqual([
      ['round', 'function'],
      ['(', 'punctuation'],
      ['price', 'name'],
      [',', 'punctuation'],
      ['2', 'number'],
      [')', 'punctuation'],
      ['+', 'operator'],
      ['x', 'name'],
      ['.', 'punctuation'],
      ['total', 'method'],
      ['(', 'punctuation'],
      [')', 'punctuation'],
    ]);
  });

  it.each([
    { formula: 'a / /b/g', expected: [['a', 'name'], ['/', 'operator'], ['/b/g', 'regexp']] },
    { formula: 'let + 1', expected: [['let', 'name'], ['+', 'operator'], ['1', 'number']] },
    { formula: 'let found = (key in obj) in found', expected: [
      ['let', 'keyword'],
      ['found', 'name'],
      ['=', 'operator'],
      ['(', 'punctuation'],
      ['key', 'name'],
      ['in', 'operator'],
      ['obj', 'name'],
      [')', 'punctuation'],
      ['in', 'keyword'],
      ['found', 'name'],
    ] },
    { formula: 'x not\n in y', expected: [['x', 'name'], ['not', 'operator'], ['in', 'operator'], ['y', 'name']] },
    { formula: '(f)(x)', expected: [['(', 'punctuation'], ['f', 'function'], [')', 'punctuation'], ['(', 'punctuation'], ['x', 'name'], [')', 'punctuation']] },
  ])('should read a word or a character by where it stands: $formula', ({ formula, expected }) => {
    expect(kinds(formula)).toEqual(expected);
  });

  it.each([
    { formula: '1 +* 2', expected: [['1', 'number'], ['+* 2', 'invalid']] },
    { formula: 'upper("abc', expected: [['upper', 'function'], ['(', 'punctuation'], ['"abc', 'invalid']] },
    { formula: 'f(1, @b)', expected: [['f', 'function'], ['(', 'punctuation'], ['1', 'number'], [',', 'punctuation'], ['@b)', 'invalid']] },
  ])('should end the tokens with the text from a syntax error, invalid: $formula', ({ formula, expected }) => {
    expect(kinds(formula)).toEqual(expected);
  });

  it('should keep the tokens of a formula still being typed, up to its end', () => {
    expect(kinds('round(price, ')).toEqual([['round', 'function'], ['(', 'punctuation'], ['price', 'name'], [', ', 'invalid']]);
  });

  it('should mark invalid the whole token a syntax error stops inside', () => {
    expect(kinds('1 + /a+/gi1')).toEqual([['1', 'number'], ['+', 'operator'], ['/a+/gi1', 'invalid']]);
  });

  it('should give no tokens for empty or blank text', () => {
    expect([tokenize(''), tokenize(' \n ')]).toEqual([[], []]);
  });

  it('should count lines and columns of the invalid text up to its end', () => {
    expect(tokenize('f(1,\n  @b\nc)').at(-1)?.location).toEqual({
      start: { offset: 7, line: 2, column: 3 },
      end: { offset: 12, line: 3, column: 3 },
    });
  });
});

/** Where parsing the text fails, or `undefined` when it parses. */
function failureStart(text: string): number | undefined {
  try {
    parse(text);

    return undefined;
  }
  catch (error) {
    return error instanceof SyntaxError ? error.location.start.offset : Number.NaN;
  }
}

function kinds(formula: string): [string, string][] {
  return tokenize(formula).map((token) => [textOf(formula, token), token.kind]);
}

function textOf(formula: string, token: FormulaToken): string {
  return formula.slice(token.location.start.offset, token.location.end.offset);
}

/** Describes what breaks the contract of the tokens: an empty, misplaced or out-of-order token, or text left out. */
function coverageProblems(text: string, tokens: readonly FormulaToken[]): string[] {
  const problems: string[] = [];
  let covered = 0;

  for (const [index, token] of tokens.entries()) {
    const { start, end } = token.location;

    if (start.offset < covered || end.offset <= start.offset || end.offset > text.length) {
      problems.push(`token ${index} at [${start.offset},${end.offset}] is empty, overlaps or leaves the text`);
    }

    if (text.slice(covered, start.offset).trim() !== '') {
      problems.push(`text "${text.slice(covered, start.offset)}" before token ${index} has no token`);
    }

    if (token.kind === 'invalid' && (index !== tokens.length - 1 || end.offset !== text.length)) {
      problems.push(`invalid token ${index} does not end the text`);
    }

    for (const [name, position] of [['start', start], ['end', end]] as const) {
      const before = text.slice(0, position.offset).split('\n');

      if (position.line !== before.length || position.column !== before.at(-1)!.length + 1) {
        problems.push(`${name} of token ${index} is at line ${position.line}, column ${position.column}`);
      }
    }

    covered = end.offset;
  }

  if (text.slice(covered).trim() !== '') {
    problems.push(`text "${text.slice(covered)}" after the tokens has no token`);
  }

  return problems;
}
