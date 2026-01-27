import { FormulaNumber } from './FormulaNumber';

describe('FormulaNumber', () => {
  describe('Initialization', () => {
    it('should initialize from number', () => {
      const result = new FormulaNumber(42);
      expect(result).toBeFormulaDataType(FormulaNumber, 42);
    });
  });
});
