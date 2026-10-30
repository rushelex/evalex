import { FormulaString } from './FormulaString';

describe('FormulaString', () => {
  describe('Initialization', () => {
    it('should initialize from string', () => {
      const result = new FormulaString('hello');
      expect(result).toBeFormulaDataType(FormulaString, 'hello');
    });
  });
});
