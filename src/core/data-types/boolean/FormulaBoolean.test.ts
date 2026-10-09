import { FormulaBoolean } from './FormulaBoolean';

describe('FormulaBoolean', () => {
  describe('Initialization', () => {
    it('should initialize from boolean', () => {
      const result = new FormulaBoolean(true);
      expect(result).toBeFormulaDataType(FormulaBoolean, true);
    });
  });
});
