import { evaluate } from '../../testing-library';
import { FormulaBoolean, FormulaNumber, FormulaString } from '../data-types';

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
      expect(() => evaluate('10 / 0')).toThrowFormulaError(
        'Division by zero.',
        [0, 6],
      );
    });

    it('should calculate modulo of two numbers', () => {
      const result = evaluate('10 % 3');
      expect(result).toBeFormulaDataType(FormulaNumber, 1);
    });

    it('should throw FormulaError when doing modulo by zero', () => {
      expect(() => evaluate('10 % 0')).toThrowFormulaError(
        'Division by zero (modulo).',
        [0, 6],
      );
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
      expect(() => evaluate('10 - "5"')).toThrowFormulaError(
        'Cannot perform math operation on a non-numeric value.',
        [0, 8],
      );

      expect(() => evaluate('"5" - 10')).toThrowFormulaError(
        'Cannot perform math operation on a non-numeric value.',
        [0, 8],
      );

      expect(() => evaluate('"5" - "10"')).toThrowFormulaError(
        'Cannot perform math operation on a non-numeric value.',
        [0, 10],
      );

      expect(() => evaluate('10 * "5"')).toThrowFormulaError(
        'Cannot perform math operation on a non-numeric value.',
        [0, 8],
      );

      expect(() => evaluate('10 / "5"')).toThrowFormulaError(
        'Cannot perform math operation on a non-numeric value.',
        [0, 8],
      );

      expect(() => evaluate('10 % "5"')).toThrowFormulaError(
        'Cannot perform math operation on a non-numeric value.',
        [0, 8],
      );
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

    it('should throw FormulaError when doing comparison on non-boolean', () => {
      expect(() => evaluate('10 < "5"')).toThrowFormulaError(
        'Comparison operands must be of the same type (Number or Date).',
        [0, 8],
      );

      expect(() => evaluate('10 <= "5"')).toThrowFormulaError(
        'Comparison operands must be of the same type (Number or Date).',
        [0, 9],
      );

      expect(() => evaluate('10 > "5"')).toThrowFormulaError(
        'Comparison operands must be of the same type (Number or Date).',
        [0, 8],
      );

      expect(() => evaluate('10 >= "5"')).toThrowFormulaError(
        'Comparison operands must be of the same type (Number or Date).',
        [0, 9],
      );
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
      expect(() => evaluate('-"text"')).toThrowFormulaError(
        'Cannot apply unary minus to a non-numeric value.',
        [0, 7],
      );

      expect(() => evaluate('-true')).toThrowFormulaError(
        'Cannot apply unary minus to a non-numeric value.',
        [0, 5],
      );

      expect(() => evaluate('-[1, 2]')).toThrowFormulaError(
        'Cannot apply unary minus to a non-numeric value.',
        [0, 7],
      );
    });
  });
});
