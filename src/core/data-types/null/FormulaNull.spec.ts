import { FormulaNull } from './FormulaNull';

describe('FormulaNull', () => {
  describe('Initialization', () => {
    it('should initialize from null', () => {
      const result = new FormulaNull();
      expect(result).toBeFormulaDataType(FormulaNull, null);
    });
  });
});
