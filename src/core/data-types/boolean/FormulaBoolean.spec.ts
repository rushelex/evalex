import { evaluate } from '../../../testing-library';
import { FormulaBoolean } from './FormulaBoolean';

describe('FormulaBoolean', () => {
  describe('Initialization', () => {
    it('should initialize from boolean', () => {
      const result = new FormulaBoolean(true);
      expect(result).toBeFormulaDataType(FormulaBoolean, true);
    });
  });

  describe('Core Methods', () => {
    describe('equal', () => {
      it('should return true for "true.equal(true)"', () => {
        const result = evaluate('true.equal(true)');
        expect(result).toBeFormulaDataType(FormulaBoolean, true);
      });

      it('should return true for "true.equal(false)"', () => {
        const result = evaluate('true.equal(false)');
        expect(result).toBeFormulaDataType(FormulaBoolean, false);
      });

      it('should return true for ""1".equal("1")"', () => {
        const result = evaluate('"1".equal("1")');
        expect(result).toBeFormulaDataType(FormulaBoolean, true);
      });

      it('should return false for "1.equal("1")"', () => {
        const result = evaluate('1.equal("1")');
        expect(result).toBeFormulaDataType(FormulaBoolean, false);
      });
    });
  });
});
