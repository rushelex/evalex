import type { LocationRange } from '~/parser/grammar/__generated__/grammar';

import { SyntaxError } from '~/parser/grammar/__generated__/grammar';

import { toThrowSyntaxError } from '../to-throw-syntax-error';

/**
 * Helper function to create a SyntaxError with proper location format.
 */
function createSyntaxError(message: string, location: [start: number, end: number]): SyntaxError {
  const [start, end] = location;
  const locationRange = {
    source: '',
    start: { offset: start, line: 1, column: start + 1 },
    end: { offset: end, line: 1, column: end + 1 },
  } satisfies LocationRange;

  return new SyntaxError(`${message}. [${start},${end}]`, [{ type: 'any' }], null, locationRange);
}

describe(toThrowSyntaxError, () => {
  describe('positive assertions', () => {
    it('should pass when SyntaxError matches message and location', () => {
      expect(() => {
        throw createSyntaxError('Division by zero', [5, 10]);
      }).toThrowSyntaxError('Division by zero', [5, 10]);
    });

    it('should handle empty error message', () => {
      expect(() => {
        throw createSyntaxError('', [1, 2]);
      }).toThrowSyntaxError('', [1, 2]);
    });

    it('should handle zero location offsets', () => {
      expect(() => {
        throw createSyntaxError('Error at start', [0, 0]);
      }).toThrowSyntaxError('Error at start', [0, 0]);
    });

    it('should handle large location offsets', () => {
      expect(() => {
        throw createSyntaxError('Error at end', [1000, 1005]);
      }).toThrowSyntaxError('Error at end', [1000, 1005]);
    });

    it('should handle message that already ends with period', () => {
      expect(() => {
        throw createSyntaxError('Invalid operation', [2, 8]);
      }).toThrowSyntaxError('Invalid operation', [2, 8]);
    });
  });

  describe('negative assertions (.not)', () => {
    it('should pass when function does not throw expected SyntaxError', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Different error', [5, 10]);
      };

      expect(throwingFunction).not.toThrowSyntaxError('Expected error', [5, 10]);
    });

    it('should pass when function throws non-SyntaxError', () => {
      const throwingFunction = () => {
        throw new Error('Regular error');
      };

      expect(throwingFunction).not.toThrowSyntaxError('Expected error', [0, 5]);
    });

    it('should pass when function does not throw', () => {
      const nonThrowingFunction = () => {
        // This function does not throw
      };

      expect(nonThrowingFunction).not.toThrowSyntaxError('Expected error', [0, 5]);
    });

    it('should fail when function throws expected SyntaxError', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Expected error', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).not.toThrowSyntaxError('Expected error', [5, 10]);
      }).toThrow();
    });
  });

  describe('failure cases', () => {
    it('should fail with incorrect message', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Division by zero', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError('Variable not found', [5, 10]);
      }).toThrow('Expected message "Variable not found. [5,10]" but got "Division by zero. [5,10]"');
    });

    it('should fail with incorrect location', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Division by zero', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError('Division by zero', [0, 3]);
      }).toThrow();
    });

    it('should fail when function throws non-SyntaxError', () => {
      const throwingFunction = () => {
        throw new Error('Regular error');
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError('Regular error', [0, 5]);
      }).toThrow('Expected SyntaxError but got Error');
    });

    it('should fail when function throws TypeError', () => {
      const throwingFunction = () => {
        throw new TypeError('Type error');
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError('Type error', [0, 5]);
      }).toThrow('Expected SyntaxError but got TypeError');
    });

    it('should fail when function does not throw', () => {
      const nonThrowingFunction = () => {
        // This function does not throw
      };

      expect(() => {
        expect(nonThrowingFunction).toThrowSyntaxError('Some error', [0, 5]);
      }).toThrow('Expected function to throw SyntaxError with message "Some error. [0,5]", but it did not throw');
    });
  });

  describe('location validation failures', () => {
    it('should fail when SyntaxError has no location', () => {
      // Create SyntaxError without location to test line 105-106
      const throwingFunction = () => {
        const error = new SyntaxError('Test error. [0,5]', [{ type: 'any' }], null, undefined!);
        throw error;
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError('Test error', [0, 5]);
      }).toThrow('Expected SyntaxError to have location, but location is undefined');
    });

    it('should fail when start location offset is incorrect', () => {
      // Use asymmetric matcher to pass message check, then fail on location
      const throwingFunction = () => {
        throw createSyntaxError('Test error', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError(expect.any(String), [0, 10]);
      }).toThrow('Expected location [0, 10] but got [5, 10]');
    });

    it('should fail when end location offset is incorrect', () => {
      // Use asymmetric matcher to pass message check, then fail on location
      const throwingFunction = () => {
        throw createSyntaxError('Test error', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError(expect.any(String), [5, 15]);
      }).toThrow('Expected location [5, 15] but got [5, 10]');
    });

    it('should fail when both start and end location offsets are incorrect', () => {
      // Use asymmetric matcher to pass message check, then fail on location
      const throwingFunction = () => {
        throw createSyntaxError('Test error', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError(expect.any(String), [0, 15]);
      }).toThrow('Expected location [0, 15] but got [5, 10]');
    });
  });

  describe('asymmetric matchers', () => {
    it('should pass with expect.stringContaining() for error message', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Division by zero is not allowed', [5, 10]);
      };

      expect(throwingFunction).toThrowSyntaxError(expect.stringContaining('zero'), [5, 10]);
    });

    it('should pass with expect.stringMatching() for error message', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Error code: 123', [0, 5]);
      };

      expect(throwingFunction).toThrowSyntaxError(expect.stringMatching(/Error code: \d+/), [0, 5]);
    });

    it('should pass with expect.any(String) for error message', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Any error message', [5, 10]);
      };

      expect(throwingFunction).toThrowSyntaxError(expect.any(String), [5, 10]);
    });

    it('should fail when asymmetric matcher does not match', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Division by zero', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError(expect.stringContaining('syntax'), [5, 10]);
      }).toThrow();
    });

    it('should work with .not and asymmetric matchers', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Division by zero', [5, 10]);
      };

      expect(throwingFunction).not.toThrowSyntaxError(expect.stringContaining('syntax'), [5, 10]);
    });
  });
});
