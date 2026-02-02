import {
  checkInstance,
  getTypeName,
  stringify,
} from '../utils';

describe('utils', () => {
  describe('getTypeName', () => {
    it('should return "null" for null', () => {
      expect(getTypeName(null)).toBe('null');
    });

    it('should return "undefined" for undefined', () => {
      expect(getTypeName(undefined)).toBe('undefined');
    });

    it('should return constructor name for objects', () => {
      expect(getTypeName({})).toBe('Object');
      expect(getTypeName([])).toBe('Array');
      expect(getTypeName(new Error('message'))).toBe('Error');
    });

    it('should return typeof for primitives', () => {
      expect(getTypeName('hello')).toBe('string');
      expect(getTypeName(42)).toBe('number');
      expect(getTypeName(true)).toBe('boolean');
    });

    it('should return "Object" for objects without constructor', () => {
      // eslint-disable-next-line ts/no-unsafe-assignment
      const objWithoutConstructor = Object.create(null);
      expect(getTypeName(objWithoutConstructor)).toBe('Object');
    });
  });

  describe('checkInstance', () => {
    it('should return true for matching instance', () => {
      const error = new Error('test');
      const result = checkInstance(error, Error);
      expect(result.isInstance).toBe(true);
      expect(result.actualTypeName).toBe('Error');
      expect(result.expectedTypeName).toBe('Error');
    });

    it('should return false for non-matching instance', () => {
      const result = checkInstance('not an error', Error);
      expect(result.isInstance).toBe(false);
      expect(result.actualTypeName).toBe('string');
      expect(result.expectedTypeName).toBe('Error');
    });
  });

  describe('stringify', () => {
    it('should return "null" for null', () => {
      expect(stringify(null)).toBe('null');
    });

    it('should return "undefined" for undefined', () => {
      expect(stringify(undefined)).toBe('undefined');
    });

    it('should wrap strings in single quotes', () => {
      expect(stringify('hello')).toBe('\'hello\'');
      expect(stringify('')).toBe('\'\'');
    });

    it('should convert numbers to string', () => {
      expect(stringify(42)).toBe('42');
      expect(stringify(0)).toBe('0');
      expect(stringify(-123.45)).toBe('-123.45');
    });

    it('should convert booleans to string', () => {
      expect(stringify(true)).toBe('true');
      expect(stringify(false)).toBe('false');
    });

    it('should format arrays', () => {
      expect(stringify([1, 2, 3])).toBe('[1, 2, 3]');
      expect(stringify([])).toBe('[]');
      expect(stringify(['a', 'b'])).toBe('[\'a\', \'b\']');
    });

    it('should format nested arrays', () => {
      expect(stringify([[1, 2], [3, 4]])).toBe('[[1, 2], [3, 4]]');
    });

    it('should JSON.stringify objects', () => {
      expect(stringify({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
      expect(stringify({})).toBe('{}');
    });

    it('should handle objects that fail JSON.stringify', () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;
      expect(stringify(circular)).toBe('[object Object]');
    });

    it('should handle symbols', () => {
      expect(stringify(Symbol('test'))).toBe('Symbol(test)');
    });

    it('should handle functions', () => {
      expect(stringify(() => {})).toBe('() => {}');
      expect(stringify(() => {
        // eslint-disable-next-line no-console
        console.log('test');
      })).toBe(`() => {
        console.log("test");
      }`);
    });

    it('should handle BigInt', () => {
      expect(stringify(BigInt(123))).toBe('123');
    });
  });
});
