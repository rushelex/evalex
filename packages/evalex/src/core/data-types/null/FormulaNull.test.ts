import { FormulaArray } from '../array';
import { FormulaNumber } from '../number';
import { FormulaObject } from '../object';
import { FormulaNull } from './FormulaNull';

describe('FormulaNull', () => {
  describe('Initialization', () => {
    it('should initialize from null', () => {
      const result = new FormulaNull();
      expect(result).toBeFormulaDataType(FormulaNull, null);
    });
  });

  describe('toString', () => {
    it('should give no text in text and null inside a list or an object', () => {
      const list = new FormulaArray([new FormulaNumber(1), FormulaNull.instance()]);

      expect([list.toString(), list.toString({ asJSON: true }), new FormulaObject({ note: FormulaNull.instance() }).toString()]).toEqual(['1, ', '[1, null]', '{ note: null }']);
    });

    it('should give the text of the host formatter for null, inside a list too', () => {
      expect(new FormulaArray([FormulaNull.instance()]).toString({ asJSON: true, format: { null: () => '—' } })).toBe('[—]');
    });
  });
});
