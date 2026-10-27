import * as API from '../index';

describe('public API', () => {
  it('should export exactly the documented runtime values', () => {
    expect(Object.keys(API).sort()).toEqual([
      'Errors',
      'Formula',
      'FormulaArray',
      'FormulaBoolean',
      'FormulaDataType',
      'FormulaDate',
      'FormulaDateRange',
      'FormulaDuration',
      'FormulaError',
      'FormulaErrorCode',
      'FormulaNull',
      'FormulaNumber',
      'FormulaObject',
      'FormulaRegExp',
      'FormulaScope',
      'FormulaString',
      'Kind',
      'initializeFormulaCore',
    ]);
  });
});
