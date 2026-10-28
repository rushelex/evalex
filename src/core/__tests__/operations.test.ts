import { fc, it } from '@fast-check/vitest';

import { evaluate, evaluateOutcome, formulaValueArbitrary, loc } from '../../testing-library';
import { FormulaArray, FormulaBoolean, FormulaDateRange, FormulaDateTime, FormulaDuration, FormulaNull, FormulaNumber, FormulaObject, FormulaRegExp, FormulaString, Kind } from '../data-types';
import { exactValue } from '../data-types/number/exact-value';
import { Errors, FormulaError } from '../errors';

const BINARY_OPERATORS = ['+', '-', '*', '/', '%', '^', '==', '!=', '<', '<=', '>', '>=', 'in', 'not in', 'and', '&&', 'or', '||'] as const;

const UNARY_OPERATORS = ['-', '!', 'not'] as const;

const ARITHMETIC_ROUTINES = [['+', 'add'], ['-', 'subtract'], ['*', 'multiply'], ['/', 'divide'], ['%', 'mod'], ['^', 'pow']] as const;

// Decimals of up to 15 significant digits, built from integer units so that the decimal is exact.
const decimal = fc
  .tuple(fc.integer({ min: -999_999_999, max: 999_999_999 }), fc.integer({ min: 0, max: 6 }))
  .map(([units, scale]) => Number(`${units}e-${scale}`));

const nonZeroDecimal = fc
  .tuple(fc.oneof(fc.integer({ min: -999, max: -1 }), fc.integer({ min: 1, max: 999 })), fc.integer({ min: 0, max: 2 }))
  .map(([units, scale]) => Number(`${units}e-${scale}`));

// Finite numbers with the ends of the range common, where results overflow.
const largeNumber = fc.oneof(
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.constantFrom(Number.MAX_VALUE, -Number.MAX_VALUE, 1e308, -1e308, 1e200, -1e-300),
);

// Formulas over two numbers `a` and `b` that compute a number.
const NUMERIC_FORMULAS = [
  'a + b',
  'a - b',
  'a * b',
  'a / b',
  'a % b',
  'a ^ b',
  '-a',
  'pow(a, b)',
  'exp(a)',
  'sqrt(a)',
  'cbrt(a)',
  'ln(a)',
  'sum(a, b)',
  'mean(a, b)',
  'median([a, b, b])',
  'toNumber(format(a) + "e300")',
] as const;

const anyValue = formulaValueArbitrary();

// Values of different kinds that look alike, where comparisons between kinds tend to slip.
const LOOKALIKES = [
  new FormulaNumber(0),
  new FormulaNumber(1),
  new FormulaString(''),
  new FormulaString('0'),
  FormulaBoolean.from(false),
  FormulaBoolean.from(true),
  FormulaNull.instance(),
  FormulaArray.from([]),
  FormulaArray.from([0]),
  FormulaArray.from([0, 1]),
  new FormulaObject({}),
  FormulaObject.from({ a: 0 }),
];

const valuePair = fc.oneof(
  { weight: 1, arbitrary: fc.tuple(anyValue, anyValue) },
  { weight: 1, arbitrary: anyValue.map((value) => [value, value] as const) },
  { weight: 3, arbitrary: fc.tuple(fc.constantFrom(...LOOKALIKES), fc.constantFrom(...LOOKALIKES)) },
);

// Pairs of one kind that the ordering operators compare.
const orderedPair = fc.constantFrom(Kind.Number, Kind.String, Kind.DateTime).chain((kind) => fc.oneof(
  fc.tuple(formulaValueArbitrary(kind), formulaValueArbitrary(kind)),
  formulaValueArbitrary(kind).map((value) => [value, value] as const),
));

describe('Operations', () => {
  it.prop([fc.constantFrom(...BINARY_OPERATORS), anyValue, anyValue])('should fail only with a formula error on any operands of a binary operator', (operator, a, b) => {
    try {
      evaluate(`a ${operator} b`, { context: { a, b } });
    }
    catch (error) {
      expect(error).toBeInstanceOf(FormulaError);
    }
  });

  it.prop([fc.constantFrom(...UNARY_OPERATORS), anyValue])('should fail only with a formula error on any operand of a unary operator', (operator, a) => {
    try {
      evaluate(`${operator} a`, { context: { a } });
    }
    catch (error) {
      expect(error).toBeInstanceOf(FormulaError);
    }
  });

  it.prop([fc.constantFrom('+', '*'), formulaValueArbitrary(Kind.Number), formulaValueArbitrary(Kind.Number)])('should give the same number whatever the order of operands of + and *', (operator, a, b) => {
    const context = { a, b };

    expect(evaluateOutcome(`b ${operator} a`, { context })).toHaveSameOutcomeAs(evaluateOutcome(`a ${operator} b`, { context }));
  });

  it.prop([formulaValueArbitrary(Kind.String), anyValue])('should join text with any value as text with the value format() gives', (text, value) => {
    const context = { text, value };

    expect(evaluateOutcome('text + value', { context })).toHaveSameOutcomeAs(evaluateOutcome('text + format(value)', { context }));
    expect(evaluateOutcome('value + text', { context })).toHaveSameOutcomeAs(evaluateOutcome('format(value) + text', { context }));
  });

  it.prop([valuePair])('should compare any two values for equality the same way in both directions', ([a, b]) => {
    const context = { a, b };

    expect(evaluateOutcome('b == a', { context })).toHaveSameOutcomeAs(evaluateOutcome('a == b', { context }));
  });

  it.prop([valuePair])('should give the opposite of == for != on any two values', ([a, b]) => {
    const context = { a, b };

    expect(evaluateOutcome('a != b', { context })).toHaveSameOutcomeAs(evaluateOutcome('not (a == b)', { context }));
  });

  it.prop([anyValue])('should find any value equal to itself', (a) => {
    expect(evaluate('a == a', { context: { a } })).toBeFormulaDataType(FormulaBoolean, true);
  });

  it.prop([orderedPair])('should order two numbers, texts or dates the same way from both sides', ([a, b]) => {
    const context = { a, b };

    expect(evaluateOutcome('b > a', { context })).toHaveSameOutcomeAs(evaluateOutcome('a < b', { context }));
    expect(evaluateOutcome('b >= a', { context })).toHaveSameOutcomeAs(evaluateOutcome('a <= b', { context }));
  });

  it.prop([orderedPair])('should find exactly one of <, == and > true for two numbers, texts or dates', ([a, b]) => {
    const context = { a, b };
    const relations = ['a < b', 'a == b', 'a > b'].filter((formula) => evaluate(formula, { context }).value === true);

    expect(relations).toHaveLength(1);
    expect(evaluate('a <= b', { context })).toBeFormulaDataType(FormulaBoolean, relations[0] !== 'a > b');
  });

  it.prop([anyValue])('should treat any value as the same truth in conditions and logical operators', (a) => {
    const context = { a };
    const expected = evaluateOutcome('if(a, true, false)', { context });

    for (const formula of ['a ? true : false', 'not not a', '!!a', 'a and true', 'a or false']) {
      expect(evaluateOutcome(formula, { context })).toHaveSameOutcomeAs(expected);
    }
  });

  describe('Binary - Arithmetic', () => {
    it('should add two numbers', () => {
      const result = evaluate('10 + 5');
      expect(result).toBeFormulaDataType(FormulaNumber, 15);
    });

    it('should subtract two numbers', () => {
      const result = evaluate('10 - 5');
      expect(result).toBeFormulaDataType(FormulaNumber, 5);
    });

    it('should multiply two numbers', () => {
      const result = evaluate('10 * 5');
      expect(result).toBeFormulaDataType(FormulaNumber, 50);
    });

    it('should divide two numbers', () => {
      const result = evaluate('10 / 5');
      expect(result).toBeFormulaDataType(FormulaNumber, 2);
    });

    it('should throw FormulaError when doing division by zero', () => {
      expect(() => {
        evaluate('10 / 0');
      }).toThrow(Errors.Arithmetic.DivisionByZero.create(
        { dividend: 10 },
        { location: loc(0, 6) },
      ));
    });

    it('should calculate modulo of two numbers', () => {
      const result = evaluate('10 % 3');
      expect(result).toBeFormulaDataType(FormulaNumber, 1);
    });

    it('should throw FormulaError when doing modulo by zero', () => {
      expect(() => {
        evaluate('10 % 0');
      }).toThrow(Errors.Arithmetic.ModuloByZero.create(
        { dividend: 10 },
        { location: loc(0, 6) },
      ));
    });

    it('should concatenate strings with +', () => {
      const result = evaluate('"hello" + " " + "world"');
      expect(result).toBeFormulaDataType(FormulaString, 'hello world');
    });

    it('should concatenate string and number (coercing number to string)', () => {
      const result = evaluate('"apples: " + 5');
      expect(result).toBeFormulaDataType(FormulaString, 'apples: 5');
    });

    it('should concatenate number and string (coercing number to string)', () => {
      const result1 = evaluate('5 + " apples"');
      expect(result1).toBeFormulaDataType(FormulaString, '5 apples');

      const result2 = evaluate('5 + " apples" + " and bananas"');
      expect(result2).toBeFormulaDataType(FormulaString, '5 apples and bananas');
    });

    it.each([
      { kind: 'a number', value: new FormulaNumber(1.5), text: 'x1.5' },
      { kind: 'a boolean', value: FormulaBoolean.from(true), text: 'xtrue' },
      { kind: 'null', value: FormulaNull.instance(), text: 'x' },
      { kind: 'a list', value: FormulaArray.from([1, 'a', [2]]), text: 'x1, a, 2' },
      { kind: 'an object', value: FormulaObject.from({ a: 1 }), text: 'x{ a: 1 }' },
      { kind: 'a date', value: FormulaDateTime.from('2024-07-28T14:35:00Z'), text: 'x2024-07-28T14:35:00Z' },
      { kind: 'a duration', value: FormulaDuration.from(Temporal.Duration.from('P1DT2H')), text: 'xP1DT2H' },
      { kind: 'a regular expression', value: FormulaRegExp.from(/a+/g), text: 'x/a+/g' },
    ])('should join text with $kind as the text format() gives', ({ value, text }) => {
      expect(evaluate('"x" + value', { context: { value } })).toBeFormulaDataType(FormulaString, text);
    });

    it('should throw FormulaError when doing math on non-number', () => {
      expect(() => {
        evaluate('10 - "5"');
      }).toThrowError(Errors.Evaluation.NonNumericMath.create(
        { expression: '10 - "5"' },
        { location: loc(0, 8) },
      ));

      expect(() => {
        evaluate('"5" - 10');
      }).toThrowError(Errors.Evaluation.NonNumericMath.create(
        { expression: '"5" - 10' },
        { location: loc(0, 8) },
      ));

      expect(() => {
        evaluate('"5" - "10"');
      }).toThrow(Errors.Evaluation.NonNumericMath.create(
        { expression: '"5" - "10"' },
        { location: loc(0, 10) },
      ));

      expect(() => {
        evaluate('10 * "5"');
      }).toThrow(Errors.Evaluation.NonNumericMath.create(
        { expression: '10 * "5"' },
        { location: loc(0, 8) },
      ));

      expect(() => {
        evaluate('10 / "5"');
      }).toThrow(Errors.Evaluation.NonNumericMath.create(
        { expression: '10 / "5"' },
        { location: loc(0, 8) },
      ));

      expect(() => {
        evaluate('10 % "5"');
      }).toThrow(Errors.Evaluation.NonNumericMath.create(
        { expression: '10 % "5"' },
        { location: loc(0, 8) },
      ));
    });

    it('should correctly evaluate precedence and parentheses', () => {
      const result = evaluate('(2 + 3) * 4');
      expect(result).toBeFormulaDataType(FormulaNumber, 20);

      const result2 = evaluate('2 + 3 * 4');
      expect(result2).toBeFormulaDataType(FormulaNumber, 14);
    });
  });

  describe('Decimal numbers', () => {
    it.prop([decimal, nonZeroDecimal])('should give the same full number or error from an operator and its routine in both forms', (a, b) => {
      const context = { a: new FormulaNumber(a), b: new FormulaNumber(b) };

      for (const [operator, routine] of ARITHMETIC_ROUTINES) {
        const expected = fullNumber(evaluateOutcome(`a ${operator} b`, { context }));

        expect(fullNumber(evaluateOutcome(`${routine}(a, b)`, { context }))).toBe(expected);
        expect(fullNumber(evaluateOutcome(`a.${routine}(b)`, { context }))).toBe(expected);
      }
    });

    it.each([
      { formula: '0.1 + 0.2', expected: 0.3 },
      { formula: '(0.1 + 0.2) - 0.3', expected: 0 },
      { formula: '4.35 * 100', expected: 435 },
      { formula: '0.3 / 0.1 - 3', expected: 0 },
      { formula: '0.5 % 0.2 - 0.1', expected: 0 },
      { formula: '1.1 ^ 2 - 1.21', expected: 0 },
      { formula: '1 / 3 * 3', expected: 1 },
      { formula: '(2 / 3) / (1 / 3) - 2', expected: 0 },
      { formula: '-(1 / 3) * -3', expected: 1 },
      { formula: 'floor((0.1 + 0.7) * 10)', expected: 8 },
      { formula: 'ceil(sqrt(2) ^ 2)', expected: 2 },
      { formula: 'sum([0.1, 0.2, 0.3]) - 0.6', expected: 0 },
      { formula: 'sum(1 / 3, 1 / 3, 1 / 3)', expected: 1 },
      { formula: 'mean(0.1, 0.2) * 2 - 0.3', expected: 0 },
      { formula: 'mean(0.7, 0, 0, 0, 0, 0, 0) * 10 - 1', expected: 0 },
      { formula: 'median(0.1, 0.2) * 2 - 0.3', expected: 0 },
      { formula: 'min(1 / 3, 1) * 3', expected: 1 },
      { formula: 'max(1 / 3, 0) * 3', expected: 1 },
    ])('should give $expected for $formula', ({ formula, expected }) => {
      expect(evaluate(formula)).toBeFormulaDataType(FormulaNumber, expected);
    });

    it('should find 0.1 + 0.2 equal to 0.3', () => {
      expect(evaluate('0.1 + 0.2 == 0.3')).toBeFormulaDataType(FormulaBoolean, true);
    });
  });

  describe('Numbers out of range', () => {
    it.prop([fc.constantFrom(...NUMERIC_FORMULAS), largeNumber, largeNumber])('should give a finite number or a formula error with a location for numbers near the ends of the range', (formula, a, b) => {
      const outcome = evaluateOutcome(formula, { context: { a: new FormulaNumber(a), b: new FormulaNumber(b) } });

      if ('error' in outcome) {
        expect(outcome.error.location).toBeDefined();
      }
      else {
        expect(outcome.value).toBeInstanceOf(FormulaNumber);
        expect(Number.isFinite(outcome.value.value)).toBe(true);
      }
    });

    it.each([
      { formula: '10 ^ 400', value: 'Infinity', location: loc(0, 8) },
      { formula: '1e308 * 10', value: 'Infinity', location: loc(0, 10) },
      { formula: '-1e308 * 10', value: '-Infinity', location: loc(0, 11) },
      { formula: '1e400', value: 'Infinity', location: loc(0, 5) },
      { formula: '-(10 ^ 400)', value: 'Infinity', location: loc(2, 10) },
      { formula: 'exp(1000)', value: 'Infinity', location: loc(0, 9) },
      { formula: '[1e308, 1e308].sum()', value: 'Infinity', location: loc(0, 20) },
      { formula: 'toNumber("1e400")', value: 'Infinity', location: loc(0, 17) },
      { formula: 'format(10 ^ 400)', value: 'Infinity', location: loc(7, 15) },
    ])('should fail $formula at the part whose number does not fit', ({ formula, value, location }) => {
      expect(() => evaluate(formula)).toThrow(Errors.Arithmetic.NumberOutOfRange.create({ value }, { location }));
    });

    it('should fail a fractional power of a negative number, which has no real result', () => {
      expect(() => evaluate('(-8) ^ (1 / 3)')).toThrow(Errors.Arithmetic.NotARealNumber.create({ location: loc(0, 14) }));
    });
  });

  describe('Binary - Comparison', () => {
    it.each([
      { input: '5 == 5', expected: true },
      { input: '5 == 6', expected: false },
      { input: '5 != 6', expected: true },
      { input: '5 != 5', expected: false },
      { input: '5 < 6', expected: true },
      { input: '5 < 5', expected: false },
      { input: '6 < 5', expected: false },
      { input: '5 <= 5', expected: true },
      { input: '5 <= 6', expected: true },
      { input: '6 <= 5', expected: false },
      { input: '6 > 5', expected: true },
      { input: '5 > 5', expected: false },
      { input: '5 > 6', expected: false },
      { input: '5 >= 5', expected: true },
      { input: '6 >= 5', expected: true },
      { input: '5 >= 6', expected: false },
    ])('should compare numbers (==, !=, <, <=, >, >=)', ({ input, expected }) => {
      const result = evaluate(input);
      expect(result).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it.each([
      { input: '"abc" == \"abc\"', expected: true },
      { input: '"abc" == \"def\"', expected: false },
      { input: '"abc" != \"def\"', expected: true },
      { input: '"abc" != \"abc\"', expected: false },
    ])('should compare strings (==, !=)', ({ input, expected }) => {
      const result = evaluate(input);
      expect(result).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it.each([
      { input: 'true == true', expected: true },
      { input: 'false == false', expected: true },
      { input: 'true == false', expected: false },
      { input: 'true != false', expected: true },
      { input: 'true != true', expected: false },
    ])('should compare booleans (==, !=)', ({ input, expected }) => {
      const result = evaluate(input);
      expect(result).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it.each([
      { input: '5 == "5"', expected: false },
      { input: '5 != "5"', expected: true },
      { input: 'true == "true"', expected: false },
      { input: '0 == false', expected: false },
    ])('should handle type mismatches in comparisons (e.g., number == string) - should be false for ==, true for !=', ({ input, expected }) => {
      const result = evaluate(input);
      expect(result).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it.each([
      { input: '[1, [2, "a"]] == [1, [2, "a"]]', expected: true },
      { input: '[1, 2] == [2, 1]', expected: false },
      { input: '[1, 2] != [1, 2]', expected: false },
      { input: 'parseDate("2024-01-01") == parseDate("2024-01-01T00:00Z")', expected: true },
      { input: 'parseDate("2024-01-01") != parseDate("2024-01-02")', expected: true },
      { input: '/a/g == /a/g', expected: true },
      { input: '/a/g == /a/i', expected: false },
    ])('should compare lists, dates and regexps by content (==, !=): $input', ({ input, expected }) => {
      const result = evaluate(input);
      expect(result).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it('should throw FormulaError when doing comparison on non-boolean', () => {
      expect(() => {
        evaluate('10 < "5"');
      }).toThrow(Errors.Evaluation.ComparisonTypeMismatch.create(
        { expression: '10 < "5"' },
        { location: loc(0, 8) },
      ));

      expect(() => {
        evaluate('10 <= "5"');
      }).toThrow(Errors.Evaluation.ComparisonTypeMismatch.create(
        { expression: '10 <= "5"' },
        { location: loc(0, 9) },
      ));

      expect(() => {
        evaluate('10 > "5"');
      }).toThrow(Errors.Evaluation.ComparisonTypeMismatch.create(
        { expression: '10 > "5"' },
        { location: loc(0, 8) },
      ));

      expect(() => {
        evaluate('10 >= "5"');
      }).toThrow(Errors.Evaluation.ComparisonTypeMismatch.create(
        { expression: '10 >= "5"' },
        { location: loc(0, 9) },
      ));
    });

    describe('Date comparison', () => {
      const earlierDate = new FormulaDateTime(
        Temporal.ZonedDateTime.from({
          year: 2024,
          month: 1,
          day: 15,
          hour: 10,
          minute: 0,
          second: 0,
          timeZone: 'UTC',
        }),
      );

      const laterDate = new FormulaDateTime(
        Temporal.ZonedDateTime.from({
          year: 2024,
          month: 6,
          day: 20,
          hour: 14,
          minute: 30,
          second: 0,
          timeZone: 'UTC',
        }),
      );

      const sameDate = new FormulaDateTime(
        Temporal.ZonedDateTime.from({
          year: 2024,
          month: 1,
          day: 15,
          hour: 10,
          minute: 0,
          second: 0,
          timeZone: 'UTC',
        }),
      );

      it('should compare dates with < operator', () => {
        const result = evaluate('d1 < d2', { context: { d1: earlierDate, d2: laterDate } });
        expect(result).toBeFormulaDataType(FormulaBoolean, true);

        const result2 = evaluate('d1 < d2', { context: { d1: laterDate, d2: earlierDate } });
        expect(result2).toBeFormulaDataType(FormulaBoolean, false);

        const result3 = evaluate('d1 < d2', { context: { d1: earlierDate, d2: sameDate } });
        expect(result3).toBeFormulaDataType(FormulaBoolean, false);
      });

      it('should compare dates with <= operator', () => {
        const result = evaluate('d1 <= d2', { context: { d1: earlierDate, d2: laterDate } });
        expect(result).toBeFormulaDataType(FormulaBoolean, true);

        const result2 = evaluate('d1 <= d2', { context: { d1: laterDate, d2: earlierDate } });
        expect(result2).toBeFormulaDataType(FormulaBoolean, false);

        const result3 = evaluate('d1 <= d2', { context: { d1: earlierDate, d2: sameDate } });
        expect(result3).toBeFormulaDataType(FormulaBoolean, true);
      });

      it('should compare dates with > operator', () => {
        const result = evaluate('d1 > d2', { context: { d1: laterDate, d2: earlierDate } });
        expect(result).toBeFormulaDataType(FormulaBoolean, true);

        const result2 = evaluate('d1 > d2', { context: { d1: earlierDate, d2: laterDate } });
        expect(result2).toBeFormulaDataType(FormulaBoolean, false);

        const result3 = evaluate('d1 > d2', { context: { d1: earlierDate, d2: sameDate } });
        expect(result3).toBeFormulaDataType(FormulaBoolean, false);
      });

      it('should compare dates with >= operator', () => {
        const result = evaluate('d1 >= d2', { context: { d1: laterDate, d2: earlierDate } });
        expect(result).toBeFormulaDataType(FormulaBoolean, true);

        const result2 = evaluate('d1 >= d2', { context: { d1: earlierDate, d2: laterDate } });
        expect(result2).toBeFormulaDataType(FormulaBoolean, false);

        const result3 = evaluate('d1 >= d2', { context: { d1: earlierDate, d2: sameDate } });
        expect(result3).toBeFormulaDataType(FormulaBoolean, true);
      });

      it('should throw error when comparing date with non-date', () => {
        expect(() => {
          evaluate('d1 < 5', { context: { d1: earlierDate } });
        }).toThrow(Errors.Evaluation.ComparisonTypeMismatch.create(
          { expression: 'd1 < 5' },
          { location: loc(0, 6) },
        ));

        expect(() => {
          evaluate('5 > d1', { context: { d1: earlierDate } });
        }).toThrow(Errors.Evaluation.ComparisonTypeMismatch.create(
          { expression: '5 > d1' },
          { location: loc(0, 6) },
        ));
      });
    });
  });

  describe('Binary - Membership', () => {
    const week = FormulaDateRange.from({ start: '2026-10-01', end: '2026-10-07' });

    it.prop([valuePair])('should make "not in" the opposite of "in", failing with the same error', ([a, b]) => {
      expect(evaluateOutcome('a not in b', { context: { a, b } })).toHaveSameOutcomeAs(evaluateOutcome('not (a in b)', { context: { a, b } }));
    });

    it.prop([formulaValueArbitrary(Kind.Array)])('should find in a list every item of it', (list) => {
      for (const item of (list as FormulaArray).value) {
        expect(evaluate('item in list', { context: { item, list } })).toBeFormulaDataType(FormulaBoolean, true);
      }
    });

    it.prop([fc.string(), fc.string(), fc.string()])('should find any part of a text in it', (before, part, after) => {
      const context = { part: new FormulaString(part), text: new FormulaString(before + part + after) };

      expect(evaluate('part in text', { context })).toBeFormulaDataType(FormulaBoolean, true);
    });

    it.prop([formulaValueArbitrary(Kind.Object), fc.string()])('should find a name in an object exactly when the object has that field', (object, name) => {
      const expected = Object.hasOwn((object as FormulaObject).value, name);

      expect(evaluate('name in object', { context: { name: new FormulaString(name), object } })).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it.each([
      { input: '2 in [1, 2, 3]', expected: true },
      { input: '4 in [1, 2, 3]', expected: false },
      { input: '[1, 2] in [[1, 2]]', expected: true },
      { input: '"1" in [1]', expected: false },
      { input: 'null in [null]', expected: true },
      { input: '1 in []', expected: false },
    ])('should compare a value with the items of a list by content: $input', ({ input, expected }) => {
      expect(evaluate(input)).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it.each([
      { input: '"wor" in "Hello world"', expected: true },
      { input: '"World" in "Hello world"', expected: false },
      { input: '"." in "v12"', expected: false },
      { input: '"" in ""', expected: true },
    ])('should search a text for plain text, case and pattern characters included: $input', ({ input, expected }) => {
      expect(evaluate(input)).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it.each([
      { name: 'empty', expected: true },
      { name: 'price', expected: true },
      { name: 'toString', expected: false },
      { name: 'Price', expected: false },
    ])('should find only the own fields of an object, an empty one included: "$name"', ({ name, expected }) => {
      const object = FormulaObject.from({ empty: null, price: 10 });

      expect(evaluate('name in object', { context: { name: new FormulaString(name), object } })).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it.each([
      { date: '2026-10-01T00:00:00Z', expected: true },
      { date: '2026-10-04T13:42:00Z', expected: true },
      { date: '2026-10-07T00:00:00Z', expected: true },
      { date: '2026-10-07T00:00:00.001Z', expected: false },
      { date: '2026-09-30T23:59:59.999Z', expected: false },
    ])('should find a date in a range from its start to its end, both included: $date', ({ date, expected }) => {
      expect(evaluate('day in week', { context: { day: FormulaDateTime.from(date), week } })).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it('should find the one date of a range that starts and ends at it', () => {
      expect(evaluate('parseDate("2026-10-07") in dateRange(parseDate("2026-10-07"), parseDate("2026-10-07"))')).toBeFormulaDataType(FormulaBoolean, true);
    });

    it.each([
      { input: '4 not in [1, 2, 3]', expected: true },
      { input: '"b" not in "abc"', expected: false },
    ])('should negate membership with "not in": $input', ({ input, expected }) => {
      expect(evaluate(input)).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it.each([
      { input: '1 in 5', actual: Kind.Number, location: loc(5, 6) },
      { input: '1 not in true', actual: Kind.Boolean, location: loc(9, 13) },
      { input: '1 in parseDate("2026-10-07")', actual: Kind.DateTime, location: loc(5, 28) },
    ])('should fail at the right operand when nothing can be searched in it: $input', ({ input, actual, location }) => {
      expect(() => evaluate(input)).toThrow(Errors.Argument.TypeMismatch.create(
        { expected: [Kind.Array, Kind.String, Kind.Object, Kind.DateRange], actual, argumentPosition: 2 },
        { location },
      ));
    });

    it.each([
      { input: '5 in "abc"', expected: Kind.String, actual: Kind.Number, location: loc(0, 1) },
      { input: '(1 + 1) not in "abc"', expected: Kind.String, actual: Kind.Number, location: loc(1, 6) },
      { input: '5 in object', expected: Kind.String, actual: Kind.Number, location: loc(0, 1) },
      { input: '"2026-10-01" in week', expected: Kind.DateTime, actual: Kind.String, location: loc(0, 12) },
    ])('should fail at the left operand when it cannot be searched for in the right one: $input', ({ input, expected, actual, location }) => {
      const object = FormulaObject.from({ 5: true });

      expect(() => evaluate(input, { context: { object, week } })).toThrow(Errors.Argument.TypeMismatch.create(
        { expected: [expected], actual, argumentPosition: 1 },
        { location },
      ));
    });
  });

  describe('Binary - Logical', () => {
    const andCases = [
      { input: [true, true], expected: true },
      { input: [true, false], expected: false },
      { input: [false, true], expected: false },
      { input: [false, false], expected: false },
      { input: [0, '"10"'], expected: false },
      { input: [0, false], expected: false },
      { input: ['"0"', false], expected: false },
      { input: [0, '"0"'], expected: false },
      { input: [0, 0], expected: false },
    ] as const;

    it.each(andCases)('should `$input.0 and $input.1` to be `$expected`', ({ input, expected }) => {
      const result = evaluate(`${input[0]} and ${input[1]}`);
      expect(result).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it.each(andCases)('should `$input.0 && $input.1` to be `$expected`', ({ input, expected }) => {
      const result = evaluate(`${input[0]} && ${input[1]}`);
      expect(result).toBeFormulaDataType(FormulaBoolean, expected);
    });

    const orCases = [
      { input: [true, true], expected: true },
      { input: [true, false], expected: true },
      { input: [false, true], expected: true },
      { input: [false, false], expected: false },
      { input: [0, '"10"'], expected: true },
      { input: [0, false], expected: false },
      { input: ['"0"', false], expected: true },
      { input: [0, '"0"'], expected: true },
      { input: [0, 0], expected: false },
    ] as const;

    it.each(orCases)('should `$input.0 or $input.1` to be `$expected`', ({ input, expected }) => {
      const result = evaluate(`${input[0]} or ${input[1]}`);
      expect(result).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it.each(orCases)('should `$input.0 || $input.1` to be `$expected`', ({ input, expected }) => {
      const result = evaluate(`${input[0]} || ${input[1]}`);
      expect(result).toBeFormulaDataType(FormulaBoolean, expected);
    });
  });

  describe('Truth of values', () => {
    it.each([
      { formula: 'not []', expected: true },
      { formula: 'not record', expected: true },
      { formula: '[] or false', expected: false },
      { formula: '[1] and true', expected: true },
    ])('should read an empty value as false in logical operators: $formula', ({ formula, expected }) => {
      const context = { record: new FormulaObject({}) };

      expect(evaluate(formula, { context })).toBeFormulaDataType(FormulaBoolean, expected);
    });
  });

  describe('Unary', () => {
    it('should negate a number', () => {
      const result = evaluate('-10');
      expect(result).toBeFormulaDataType(FormulaNumber, -10);
    });

    it('should handle double negation for numbers', () => {
      const result = evaluate('--10');
      expect(result).toBeFormulaDataType(FormulaNumber, 10);
    });

    it.each([
      { input: 'not true', expected: false },
      { input: 'not false', expected: true },
      { input: 'not (not false)', expected: false },
      { input: '!true', expected: false },
      { input: '!!true', expected: true },
      { input: '!(!true)', expected: true },
      { input: 'not 123', expected: false },
      { input: 'not "text"', expected: false },
      { input: 'not ""', expected: true },
    ])('should `$input` to be `$expected`', ({ input, expected }) => {
      const result = evaluate(input);
      expect(result).toBeFormulaDataType(FormulaBoolean, expected);
    });

    it('should throw FormulaError for unary minus on non-number', () => {
      expect(() => {
        evaluate('-"text"');
      }).toThrow(Errors.Evaluation.UnaryMinusNonNumeric.create(
        { expression: '-"text"' },
        { location: loc(0, 7) },
      ));

      expect(() => {
        evaluate('-true');
      }).toThrow(Errors.Evaluation.UnaryMinusNonNumeric.create(
        { expression: '-true' },
        { location: loc(0, 5) },
      ));

      expect(() => {
        evaluate('-[1, 2]');
      }).toThrow(Errors.Evaluation.UnaryMinusNonNumeric.create(
        { expression: '-[1, 2]' },
        { location: loc(0, 7) },
      ));
    });
  });
});

/** The full double a number result holds behind its 15-digit value, or the message key of the error it failed with. */
function fullNumber(outcome: ReturnType<typeof evaluateOutcome>): number | string | undefined {
  if ('error' in outcome) {
    return outcome.error.messageKey;
  }

  return outcome.value instanceof FormulaNumber ? outcome.value[exactValue] : undefined;
}
