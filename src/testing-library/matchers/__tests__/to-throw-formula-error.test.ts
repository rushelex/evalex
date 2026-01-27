import { FormulaError } from '~/core';

import { toThrowFormulaError } from '../to-throw-formula-error';

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

describe(toThrowFormulaError, () => {
  describe('positive assertions', () => {
    it('should pass when FormulaError matches message and location', () => {
      expect(() => {
        throw createFormulaError('Division by zero', [5, 10]);
      }).toThrowFormulaError('Division by zero', [5, 10]);
    });

    it('should handle empty error message', () => {
      expect(() => {
        throw createFormulaError('', [1, 2]);
      }).toThrowFormulaError('', [1, 2]);
    });

    it('should handle zero location offsets', () => {
      expect(() => {
        throw createFormulaError('Error at start', [0, 0]);
      }).toThrowFormulaError('Error at start', [0, 0]);
    });

    it('should handle large location offsets', () => {
      expect(() => {
        throw createFormulaError('Error at end', [1000, 1005]);
      }).toThrowFormulaError('Error at end', [1000, 1005]);
    });
  });

  describe('negative assertions (.not)', () => {
    it('should pass when function does not throw expected FormulaError', () => {
      const throwingFunction = () => {
        throw createFormulaError('Different error', [5, 10]);
      };

      expect(throwingFunction).not.toThrowFormulaError('Expected error', [5, 10]);
    });

    it('should pass when function throws non-FormulaError', () => {
      const throwingFunction = () => {
        throw new Error('Regular error');
      };

      expect(throwingFunction).not.toThrowFormulaError('Expected error', [0, 5]);
    });

    it('should pass when function does not throw', () => {
      const nonThrowingFunction = () => {
        // This function does not throw
      };

      expect(nonThrowingFunction).not.toThrowFormulaError('Expected error', [0, 5]);
    });

    it('should fail when function throws expected FormulaError', () => {
      const throwingFunction = () => {
        throw createFormulaError('Expected error', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).not.toThrowFormulaError('Expected error', [5, 10]);
      }).toThrow();
    });
  });

  describe('failure cases', () => {
    it('should fail with incorrect message', () => {
      const throwingFunction = () => {
        throw createFormulaError('Division by zero', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).toThrowFormulaError('Variable not found', [5, 10]);
      }).toThrow('Expected message "Variable not found. [5,10]" but got "Division by zero. [5,10]"');
    });

    it('should fail with incorrect location', () => {
      const throwingFunction = () => {
        throw createFormulaError('Division by zero', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).toThrowFormulaError('Division by zero', [0, 3]);
      }).toThrow();
    });

    it('should fail when function throws non-FormulaError', () => {
      const throwingFunction = () => {
        throw new Error('Regular error');
      };

      expect(() => {
        expect(throwingFunction).toThrowFormulaError('Regular error', [0, 5]);
      }).toThrow('Expected FormulaError but got Error');
    });

    it('should fail when function throws TypeError', () => {
      const throwingFunction = () => {
        throw new TypeError('Type error');
      };

      expect(() => {
        expect(throwingFunction).toThrowFormulaError('Type error', [0, 5]);
      }).toThrow('Expected FormulaError but got TypeError');
    });

    it('should fail when function does not throw', () => {
      const nonThrowingFunction = () => {
        // This function does not throw
      };

      expect(() => {
        expect(nonThrowingFunction).toThrowFormulaError('Some error', [0, 5]);
      }).toThrow('Expected function to throw FormulaError with message "Some error. [0,5]", but it did not throw');
    });
  });

  describe('asymmetric matchers', () => {
    it('should pass with expect.stringContaining() for error message', () => {
      const throwingFunction = () => {
        throw createFormulaError('Division by zero is not allowed', [5, 10]);
      };

      expect(throwingFunction).toThrowFormulaError(expect.stringContaining('zero'), [5, 10]);
    });

    it('should pass with expect.stringMatching() for error message', () => {
      const throwingFunction = () => {
        throw createFormulaError('Error code: 123', [0, 5]);
      };

      expect(throwingFunction).toThrowFormulaError(expect.stringMatching(/Error code: \d+/), [0, 5]);
    });

    it('should pass with expect.any(String) for error message', () => {
      const throwingFunction = () => {
        throw createFormulaError('Any error message', [5, 10]);
      };

      expect(throwingFunction).toThrowFormulaError(expect.any(String), [5, 10]);
    });

    it('should fail when asymmetric matcher does not match', () => {
      const throwingFunction = () => {
        throw createFormulaError('Division by zero', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).toThrowFormulaError(expect.stringContaining('syntax'), [5, 10]);
      }).toThrow();
    });

    it('should work with .not and asymmetric matchers', () => {
      const throwingFunction = () => {
        throw createFormulaError('Division by zero', [5, 10]);
      };

      expect(throwingFunction).not.toThrowFormulaError(expect.stringContaining('syntax'), [5, 10]);
    });
  });
});
