import { FormulaNumber } from './FormulaNumber';

describe('FormulaNumber', () => {
  describe('Initialization', () => {
    it('should initialize from number', () => {
      const result = new FormulaNumber(42);
      expect(result).toBeFormulaDataType(FormulaNumber, 42);
    });

    it('should store negative zero as zero', () => {
      expect(new FormulaNumber(-0).value).toBe(0);
    });

    it('should keep the cached zero positive after creating negative zero', () => {
      FormulaNumber.from(-0);

      expect(FormulaNumber.from(0).value).toBe(0);
    });
  });
});
