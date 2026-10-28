import * as API from '../index';

describe('public API', () => {
  it('should export exactly the documented runtime values', () => {
    expect(Object.keys(API).sort()).toEqual([
      'Errors',
      'Formula',
      'FormulaError',
      'FormulaErrorCode',
      'FormulaScope',
      'Kind',
    ]);
  });
});
