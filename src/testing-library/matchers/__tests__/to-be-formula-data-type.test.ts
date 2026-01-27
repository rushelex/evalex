import { FormulaArray, FormulaBoolean, FormulaNumber, FormulaObject, FormulaString } from '~/core';

import { toBeFormulaDataType } from '../to-be-formula-data-type';

describe(toBeFormulaDataType, () => {
  describe('positive assertions', () => {
    it('should pass when FormulaNumber matches type and value', () => {
      const result = new FormulaNumber(42);
      expect(result).toBeFormulaDataType(FormulaNumber, 42);
    });

    it('should pass when FormulaString matches type and value', () => {
      const result = new FormulaString('hello');
      expect(result).toBeFormulaDataType(FormulaString, 'hello');
    });

    it('should pass when FormulaBoolean matches type and value', () => {
      const result = new FormulaBoolean(true);
      expect(result).toBeFormulaDataType(FormulaBoolean, true);
    });
  });

  describe('negative assertions (.not)', () => {
    it('should pass when type does not match', () => {
      const result = new FormulaNumber(42);
      expect(result).not.toBeFormulaDataType(FormulaString, '42');
    });

    it('should pass when value does not match', () => {
      const result = new FormulaNumber(42);
      expect(result).not.toBeFormulaDataType(FormulaNumber, 100);
    });

    it('should fail when type and value match', () => {
      const result = new FormulaNumber(42);
      expect(() => {
        expect(result).not.toBeFormulaDataType(FormulaNumber, 42);
      }).toThrow('Expected not to be FormulaNumber with value 42, but it was');
    });

    it('should fail when type and string value match', () => {
      const result = new FormulaString('hello');
      expect(() => {
        expect(result).not.toBeFormulaDataType(FormulaString, 'hello');
      }).toThrow('Expected not to be FormulaString with value \'hello\', but it was');
    });
  });

  describe('failure cases', () => {
    it('should fail when type does not match', () => {
      const result = new FormulaNumber(42);

      expect(() => {
        expect(result).toBeFormulaDataType(FormulaString, 'test');
      }).toThrow('FormulaNumber != FormulaString');
    });

    it('should fail when value does not match', () => {
      const result = new FormulaNumber(42);

      expect(() => {
        expect(result).toBeFormulaDataType(FormulaNumber, 100);
      }).toThrow('42 != 100');
    });

    it('should fail when string value does not match', () => {
      const result = new FormulaString('hello');

      expect(() => {
        expect(result).toBeFormulaDataType(FormulaString, 'world');
      }).toThrow('\'hello\' != \'world\'');
    });

    it('should fail when received is null', () => {
      expect(() => {
        expect(null).toBeFormulaDataType(FormulaNumber, 42);
      }).toThrow('null != FormulaNumber');
    });

    it('should fail when received is undefined', () => {
      expect(() => {
        expect(undefined).toBeFormulaDataType(FormulaNumber, 42);
      }).toThrow('undefined != FormulaNumber');
    });

    it('should fail when received is a plain object', () => {
      const plainObject = { value: 42 };

      expect(() => {
        expect(plainObject).toBeFormulaDataType(FormulaNumber, 42);
      }).toThrow('Object != FormulaNumber');
    });
  });

  describe('asymmetric matchers', () => {
    describe('expect.any()', () => {
      it('should pass with expect.any(Number) for numeric value', () => {
        const result = new FormulaNumber(42);
        expect(result).toBeFormulaDataType(FormulaNumber, expect.any(Number));
      });

      it('should pass with expect.any(String) for string value', () => {
        const result = new FormulaString('hello');
        expect(result).toBeFormulaDataType(FormulaString, expect.any(String));
      });

      it('should pass with expect.any(Boolean) for boolean value', () => {
        const result = new FormulaBoolean(true);
        expect(result).toBeFormulaDataType(FormulaBoolean, expect.any(Boolean));
      });

      it('should fail with wrong expect.any() type', () => {
        const result = new FormulaNumber(42);
        expect(() => {
          expect(result).toBeFormulaDataType(FormulaNumber, expect.any(String));
        }).toThrow();
      });
    });

    describe('expect.stringContaining()', () => {
      it('should pass when string contains expected substring', () => {
        const result = new FormulaString('hello world');
        expect(result).toBeFormulaDataType(FormulaString, expect.stringContaining('world'));
      });

      it('should fail when string does not contain expected substring', () => {
        const result = new FormulaString('hello');
        expect(() => {
          expect(result).toBeFormulaDataType(FormulaString, expect.stringContaining('world'));
        }).toThrow();
      });
    });

    describe('expect.stringMatching()', () => {
      it('should pass when string matches regex', () => {
        const result = new FormulaString('hello123');
        expect(result).toBeFormulaDataType(FormulaString, expect.stringMatching(/^hello\d+$/));
      });

      it('should fail when string does not match regex', () => {
        const result = new FormulaString('hello');
        expect(() => {
          expect(result).toBeFormulaDataType(FormulaString, expect.stringMatching(/^world/));
        }).toThrow();
      });
    });

    describe('expect.objectContaining()', () => {
      it('should pass when object contains expected properties', () => {
        const result = FormulaObject.from({ name: 'test', age: 25 });
        expect(result).toBeFormulaDataType(
          FormulaObject,
          expect.objectContaining({ name: new FormulaString('test') }),
        );
      });

      it('should fail when object does not contain expected properties', () => {
        const result = FormulaObject.from({ name: 'test' });
        expect(() => {
          expect(result).toBeFormulaDataType(
            FormulaObject,
            expect.objectContaining({ missing: new FormulaString('value') }),
          );
        }).toThrow();
      });
    });

    describe('expect.arrayContaining()', () => {
      it('should pass when array contains expected elements', () => {
        const result = FormulaArray.from([1, 2, 3, 4, 5]);
        expect(result).toBeFormulaDataType(
          FormulaArray,
          expect.arrayContaining([new FormulaNumber(2), new FormulaNumber(4)]),
        );
      });

      it('should fail when array does not contain expected elements', () => {
        const result = FormulaArray.from([1, 2, 3]);
        expect(() => {
          expect(result).toBeFormulaDataType(
            FormulaArray,
            expect.arrayContaining([new FormulaNumber(5)]),
          );
        }).toThrow();
      });
    });

    describe('expect.closeTo()', () => {
      it('should pass when number is close to expected value', () => {
        const result = new FormulaNumber(0.1 + 0.2);
        expect(result).toBeFormulaDataType(FormulaNumber, expect.closeTo(0.3, 5));
      });

      it('should fail when number is not close to expected value', () => {
        const result = new FormulaNumber(0.5);
        expect(() => {
          expect(result).toBeFormulaDataType(FormulaNumber, expect.closeTo(0.3, 2));
        }).toThrow();
      });
    });

    describe('combined with .not', () => {
      it('should pass .not when asymmetric matcher does not match', () => {
        const result = new FormulaString('hello');
        expect(result).not.toBeFormulaDataType(FormulaString, expect.stringContaining('world'));
      });

      it('should fail .not when asymmetric matcher matches', () => {
        const result = new FormulaString('hello world');
        expect(() => {
          expect(result).not.toBeFormulaDataType(FormulaString, expect.stringContaining('world'));
        }).toThrow();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle zero value', () => {
      const result = new FormulaNumber(0);
      expect(result).toBeFormulaDataType(FormulaNumber, 0);
    });

    it('should handle empty string', () => {
      const result = new FormulaString('');
      expect(result).toBeFormulaDataType(FormulaString, '');
    });

    it('should handle false boolean', () => {
      const result = new FormulaBoolean(false);
      expect(result).toBeFormulaDataType(FormulaBoolean, false);
    });

    it('should handle empty object', () => {
      const result = FormulaObject.from({});
      expect(result).toBeFormulaDataType(FormulaObject, {});
    });

    it('should handle non-empty object', () => {
      const result = FormulaObject.from({ field: 'test' });
      expect(result).toBeFormulaDataType(FormulaObject, { field: new FormulaString('test') });
    });

    it('should handle empty arrays', () => {
      const result = FormulaArray.from([]);
      expect(result).toBeFormulaDataType(FormulaArray, []);
    });

    it('should handle non-empty arrays', () => {
      const result = FormulaArray.from(['test']);
      expect(result).toBeFormulaDataType(FormulaArray, [new FormulaString('test')]);
    });

    it('should handle non-empty arrays with nested arrays', () => {
      const result = FormulaArray.from(['test', ['test-child-1', 'test-child-2']]);
      expect(result).toBeFormulaDataType(FormulaArray, [new FormulaString('test'), new FormulaArray([new FormulaString('test-child-1'), new FormulaString('test-child-2')])]);
    });
  });
});
