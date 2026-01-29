import { FormulaRegExp } from './FormulaRegExp';

describe('FormulaRegExp', () => {
  describe('Constructor', () => {
    it('should create FormulaRegExp from pattern string and flags', () => {
      const regex = new FormulaRegExp('\\d+', 'g');

      expect(regex.pattern).toBe('\\d+');
      expect(regex.flags).toBe('g');
      expect(regex.displayType).toBe('RegExp');
    });

    it('should create FormulaRegExp from pattern string without flags', () => {
      const regex = new FormulaRegExp('\\d+');

      expect(regex.pattern).toBe('\\d+');
      expect(regex.flags).toBe('');
    });

    it('should create FormulaRegExp from native RegExp object', () => {
      // eslint-disable-next-line regexp/no-useless-flag
      const nativeRegex = /\d+/gi;
      const regex = new FormulaRegExp(nativeRegex);

      expect(regex.pattern).toBe('\\d+');
      expect(regex.flags).toBe('gi');
    });
  });

  describe('toRegExp', () => {
    it('should create fresh RegExp instance each time', () => {
      const regex = new FormulaRegExp('\\d+', 'g');

      const regExp1 = regex.toRegExp();
      const regExp2 = regex.toRegExp();

      expect(regExp1).not.toBe(regExp2); // Different instances
      expect(regExp1.source).toBe(regExp2.source);
      expect(regExp1.flags).toBe(regExp2.flags);
    });

    it('should create RegExp with correct pattern and flags', () => {
      const regex = new FormulaRegExp('test', 'i');
      const regExp = regex.toRegExp();

      expect(regExp.source).toBe('test');
      expect(regExp.flags).toBe('i');
      expect(regExp.test('TEST')).toBe(true);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty pattern', () => {
      const regex = new FormulaRegExp('');
      expect(regex.isEmpty()).toBe(true);
    });

    it('should return false for non-empty pattern', () => {
      const regex = new FormulaRegExp('\\d+');
      expect(regex.isEmpty()).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return regex string representation', () => {
      const regex = new FormulaRegExp('\\d+', 'g');
      expect(regex.toString()).toBe('/\\d+/g');
    });

    it('should return regex string without flags', () => {
      const regex = new FormulaRegExp('test');
      expect(regex.toString()).toBe('/test/');
    });

    it('should return JSON representation when asJSON is true', () => {
      const regex = new FormulaRegExp('\\d+', 'g');
      expect(regex.toString({ asJSON: true })).toBe('"/\\d+/g"');
    });
  });

  describe('Static Methods', () => {
    describe('from', () => {
      it('should create FormulaRegExp from pattern and flags', () => {
        const regex = FormulaRegExp.from('\\w+', 'i');

        expect(regex.pattern).toBe('\\w+');
        expect(regex.flags).toBe('i');
      });

      it('should create FormulaRegExp from native RegExp', () => {
        const nativeRegex = /hello/gi;
        const regex = FormulaRegExp.from(nativeRegex);

        expect(regex.pattern).toBe('hello');
        expect(regex.flags).toBe('gi');
      });
    });

    describe('isValidInput', () => {
      it('should return true for RegExp objects', () => {
        const nativeRegex = /test/g;
        expect(FormulaRegExp.isValidInput(nativeRegex)).toBe(true);
      });

      it('should return false for non-RegExp objects', () => {
        expect(FormulaRegExp.isValidInput('string')).toBe(false);
        expect(FormulaRegExp.isValidInput(123)).toBe(false);
        expect(FormulaRegExp.isValidInput({})).toBe(false);
        expect(FormulaRegExp.isValidInput(null)).toBe(false);
        expect(FormulaRegExp.isValidInput(undefined)).toBe(false);
      });
    });
  });

  describe('Stateless Behavior', () => {
    it('should not maintain state between toRegExp() calls', () => {
      const regex = new FormulaRegExp('\\d+', 'g');
      const text = '123 456 789';

      // First execution
      const regExp1 = regex.toRegExp();
      const match1 = regExp1.exec(text);
      expect(match1?.[0]).toBe('123');

      // Second execution with fresh RegExp should start from beginning
      const regExp2 = regex.toRegExp();
      const match2 = regExp2.exec(text);
      expect(match2?.[0]).toBe('123'); // Should be '123', not '456'
    });
  });

  describe('Edge Cases', () => {
    it('should handle special regex characters in pattern', () => {
      const regex = new FormulaRegExp('\\[\\]\\(\\)\\{\\}\\*\\+\\?\\|\\^\\$\\.');

      expect(regex.pattern).toBe('\\[\\]\\(\\)\\{\\}\\*\\+\\?\\|\\^\\$\\.');
      expect(() => regex.toRegExp()).not.toThrow();
    });

    it('should handle all valid regex flags', () => {
      const regex = new FormulaRegExp('test', 'gimsuy');

      expect(regex.flags).toBe('gimsuy');
      expect(() => regex.toRegExp()).not.toThrow();
    });

    it('should handle empty flags', () => {
      const regex = new FormulaRegExp('test', '');

      expect(regex.flags).toBe('');
      expect(regex.toString()).toBe('/test/');
    });
  });
});
