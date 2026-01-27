import { FormulaError } from '~/core';

import { toBeFormulaError } from '../to-be-formula-error';

describe(toBeFormulaError, () => {
  describe('positive assertions', () => {
    it('should pass when FormulaError matches message and location', () => {
      const error = createFormulaError('Division by zero', [5, 10]);
      expect(error).toBeFormulaError('Division by zero', [5, 10]);
    });

    it('should handle empty error message', () => {
      const error = createFormulaError('', [1, 2]);
      expect(error).toBeFormulaError('', [1, 2]);
    });

    it('should handle zero location offsets', () => {
      const error = createFormulaError('Error at start', [0, 0]);
      expect(error).toBeFormulaError('Error at start', [0, 0]);
    });

    it('should handle large location offsets', () => {
      const error = createFormulaError('Error at end', [1000, 1005]);
      expect(error).toBeFormulaError('Error at end', [1000, 1005]);
    });
  });

  describe('negative assertions (.not)', () => {
    it('should pass when message does not match', () => {
      const error = createFormulaError('Different error', [5, 10]);
      expect(error).not.toBeFormulaError('Expected error', [5, 10]);
    });

    it('should pass when location does not match', () => {
      const error = createFormulaError('Same error', [5, 10]);
      expect(error).not.toBeFormulaError('Same error', [0, 5]);
    });

    it('should pass when value is not a FormulaError', () => {
      const notAnError = { message: 'Not a FormulaError' };
      expect(notAnError).not.toBeFormulaError('Not a FormulaError', [0, 5]);
    });

    it('should fail when FormulaError matches', () => {
      const error = createFormulaError('Expected error', [5, 10]);
      expect(() => {
        expect(error).not.toBeFormulaError('Expected error', [5, 10]);
      }).toThrow('Expected not to be FormulaError with message "Expected error. [5,10]", but it was');
    });
  });

  describe('failure cases', () => {
    it('should fail with incorrect message', () => {
      const error = createFormulaError('Division by zero', [5, 10]);
      expect(() => {
        expect(error).toBeFormulaError('Variable not found', [5, 10]);
      }).toThrow('Expected message "Variable not found. [5,10]" but got "Division by zero. [5,10]"');
    });

    it('should fail with incorrect location', () => {
      const error = createFormulaError('Division by zero', [5, 10]);
      expect(() => {
        expect(error).toBeFormulaError('Division by zero', [0, 3]);
      }).toThrow('Expected message "Division by zero. [0,3]" but got "Division by zero. [5,10]"');
    });

    it('should fail when received is not a FormulaError', () => {
      const notAnError = new Error('Regular error');
      expect(() => {
        expect(notAnError).toBeFormulaError('Regular error', [0, 5]);
      }).toThrow('Expected FormulaError but got Error');
    });

    it('should fail when received is null', () => {
      expect(() => {
        expect(null).toBeFormulaError('Some error', [0, 5]);
      }).toThrow('Expected FormulaError but got null');
    });

    it('should fail when received is undefined', () => {
      expect(() => {
        expect(undefined).toBeFormulaError('Some error', [0, 5]);
      }).toThrow('Expected FormulaError but got undefined');
    });

    it('should fail when received is a plain object', () => {
      const plainObject = { message: 'Some error. [0,5]' };
      expect(() => {
        expect(plainObject).toBeFormulaError('Some error', [0, 5]);
      }).toThrow('Expected FormulaError but got Object');
    });

    it('should fail when received is a primitive string', () => {
      expect(() => {
        expect('error string').toBeFormulaError('Some error', [0, 5]);
      }).toThrow('Expected FormulaError but got string');
    });

    it('should fail when received is a number', () => {
      expect(() => {
        expect(42).toBeFormulaError('Some error', [0, 5]);
      }).toThrow('Expected FormulaError but got number');
    });
  });

  describe('asymmetric matchers', () => {
    it('should pass with expect.stringContaining() for error message', () => {
      const error = createFormulaError('Division by zero is not allowed', [5, 10]);
      expect(error).toBeFormulaError(expect.stringContaining('zero'), [5, 10]);
    });

    it('should pass with expect.stringMatching() for error message', () => {
      const error = createFormulaError('Error code: 123', [0, 5]);
      expect(error).toBeFormulaError(expect.stringMatching(/Error code: \d+/), [0, 5]);
    });

    it('should pass with expect.any(String) for error message', () => {
      const error = createFormulaError('Any error message', [5, 10]);
      expect(error).toBeFormulaError(expect.any(String), [5, 10]);
    });

    it('should fail when asymmetric matcher does not match', () => {
      const error = createFormulaError('Division by zero', [5, 10]);
      expect(() => {
        expect(error).toBeFormulaError(expect.stringContaining('syntax'), [5, 10]);
      }).toThrow();
    });

    it('should work with .not and asymmetric matchers', () => {
      const error = createFormulaError('Division by zero', [5, 10]);
      expect(error).not.toBeFormulaError(expect.stringContaining('syntax'), [5, 10]);
    });
  });
});

/**
 * Helper function to create a FormulaError with proper location format.
 */
function createFormulaError(message: string, location: [start: number, end: number]): FormulaError {
  const [start, end] = location;
  return new FormulaError(message, {
    context: {},
    location: {
      start: { offset: start, line: 1, column: start + 1 },
      end: { offset: end, line: 1, column: end + 1 },
    },
  });
}
