import { Temporal } from 'temporal-polyfill';

import { evaluate, loc } from '../../testing-library';
import { FormulaBoolean, FormulaDate, FormulaNumber, FormulaString } from '../data-types';
import { Errors } from '../errors';

describe('Operations', () => {
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
      const earlierDate = new FormulaDate(
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

      const laterDate = new FormulaDate(
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

      const sameDate = new FormulaDate(
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
