import { FormulaBoolean } from '../boolean';
import { FormulaNumber } from '../number';
import { FormulaObject } from '../object';
import { FormulaString } from '../string';
import { FormulaArray } from './FormulaArray';

describe('FormulaArray', () => {
  describe('Constructor', () => {
    it('should accept array of FormulaDataType objects', () => {
      const array = new FormulaArray([
        new FormulaString('hello'),
        new FormulaNumber(42),
        new FormulaBoolean(true),
      ]);
      expect(array.value[0]).toBeFormulaDataType(FormulaString, 'hello');
      expect(array.value[1]).toBeFormulaDataType(FormulaNumber, 42);
      expect(array.value[2]).toBeFormulaDataType(FormulaBoolean, true);
    });
  });

  describe('"convert" Static Method with Plain Arrays', () => {
    it('should convert plain JavaScript arrays to FormulaDataType[]', () => {
      const array = FormulaArray.convert(['hello', 42, true]);
      expect(array).toBeInstanceOf(Array);
      expect(array[0]).toBeFormulaDataType(FormulaString, 'hello');
      expect(array[1]).toBeFormulaDataType(FormulaNumber, 42);
      expect(array[2]).toBeFormulaDataType(FormulaBoolean, true);
    });

    it('should handle nested arrays', () => {
      const array = FormulaArray.convert(['hello', [42, true]]);
      expect(array).toBeInstanceOf(Array);
      expect(array[0]).toBeFormulaDataType(FormulaString, 'hello');
      expect(array[1]).toBeInstanceOf(FormulaArray);
      expect(array[1].value[0]).toBeFormulaDataType(FormulaNumber, 42);
      expect(array[1].value[1]).toBeFormulaDataType(FormulaBoolean, true);
    });

    it('should handle objects', () => {
      const array = FormulaArray.convert(['hello', { name: 'John', age: 30 }]);
      expect(array).toBeInstanceOf(Array);
      expect(array[0]).toBeFormulaDataType(FormulaString, 'hello');
      expect(array[1]).toBeInstanceOf(FormulaObject);
      if (array[1] instanceof FormulaObject) {
        expect(array[1].value.name.value).toBe('John');
        expect(array[1].value.age.value).toBe(30);
      }
    });
  });

  describe('"from" Static Method with Plain Arrays', () => {
    it('should convert plain JavaScript array to FormulaArray instance', () => {
      const array = FormulaArray.from(['hello', 42, true]);
      expect(array).toBeInstanceOf(FormulaArray);
      expect(array.value[0]).toBeFormulaDataType(FormulaString, 'hello');
      expect(array.value[1]).toBeFormulaDataType(FormulaNumber, 42);
      expect(array.value[2]).toBeFormulaDataType(FormulaBoolean, true);
    });
  });
});
