import type * as Root from '../index';
import type * as API from '../language';

describe('language API', () => {
  it('should type tokens with their kind and the location the root API uses', () => {
    expectTypeOf<typeof API.tokenize>().toEqualTypeOf<(text: string) => API.FormulaToken[]>();
    expectTypeOf<API.FormulaToken['kind']>().toEqualTypeOf<API.FormulaTokenKind>();
    expectTypeOf<API.FormulaToken['location']>().toEqualTypeOf<Root.FormulaLocation>();
  });

  it('should type token kinds as plain text', () => {
    expectTypeOf<'function'>().toExtend<API.FormulaTokenKind>();
    expectTypeOf<'invalid'>().toExtend<API.FormulaTokenKind>();
  });
});
