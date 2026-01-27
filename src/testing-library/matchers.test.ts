import type { LocationRange } from '~/parser/grammar/__generated__/grammar';
import { SyntaxError } from '~/parser/grammar/__generated__/grammar';

describe('toThrowSyntaxError', () => {
  const createSyntaxError = (message: string, location: [start: number, end: number]) => {
    const [start, end] = location;
    const locationRange = {
      source: '',
      start: { offset: start, line: 1, column: start + 1 },
      end: { offset: end, line: 1, column: end + 1 },
    } satisfies LocationRange;

    return new SyntaxError(`${message}. [${start},${end}]`, [{ type: 'any' }], null, locationRange);
  };

  describe('throw SyntaxError with correct message and location', () => {
    it('should pass the test', () => {
      expect(() => {
        throw createSyntaxError('Division by zero', [5, 10]);
      }).toThrowSyntaxError('Division by zero', [5, 10]);
    });
  });

  describe('throw SyntaxError with incorrect message', () => {
    it('should fail the test', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Division by zero', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError('Variable not found', [5, 10]);
      }).toThrow('Expected message "Variable not found. [5,10]" but got "Division by zero. [5,10]"');
    });
  });

  describe('throw SyntaxError with incorrect location', () => {
    it('should fail the test', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Division by zero', [5, 10]);
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError('Division by zero', [0, 3]);
      }).toThrow();
    });
  });

  describe('throw non-SyntaxError', () => {
    it('should fail the test', () => {
      const throwingFunction = () => {
        throw new Error('Regular error');
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError('Regular error', [0, 5]);
      }).toThrow();
    });

    it('should fail with TypeError', () => {
      const throwingFunction = () => {
        throw new TypeError('Type error');
      };

      expect(() => {
        expect(throwingFunction).toThrowSyntaxError('Type error', [0, 5]);
      }).toThrow();
    });
  });

  describe('do not throw', () => {
    it('should fail the test', () => {
      const nonThrowingFunction = () => {
        // This function does not throw
      };

      expect(() => {
        expect(nonThrowingFunction).toThrowSyntaxError('Some error', [0, 5]);
      }).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty error message', () => {
      const throwingFunction = () => {
        throw createSyntaxError('', [1, 2]);
      };

      expect(throwingFunction).toThrowSyntaxError('', [1, 2]);
    });

    it('should handle zero location offsets', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Error at start', [0, 0]);
      };

      expect(throwingFunction).toThrowSyntaxError('Error at start', [0, 0]);
    });

    it('should handle large location offsets', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Error at end', [1000, 1005]);
      };

      expect(throwingFunction).toThrowSyntaxError('Error at end', [1000, 1005]);
    });

    it('should handle message that already ends with period', () => {
      const throwingFunction = () => {
        throw createSyntaxError('Invalid operation', [2, 8]);
      };

      expect(throwingFunction).toThrowSyntaxError('Invalid operation', [2, 8]);
    });
  });

  describe('negated matcher', () => {
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
});
