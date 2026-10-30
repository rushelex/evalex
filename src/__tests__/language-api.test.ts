import * as API from '../language';

describe('language API', () => {
  it('should export exactly the documented runtime values', () => {
    expect(Object.keys(API).sort()).toEqual(['FormulaLanguage', 'tokenize']);
  });
});
