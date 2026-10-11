import type * as API from '../index';

describe('public API', () => {
  it('should type kinds as plain text', () => {
    expectTypeOf<'Number'>().toExtend<API.Kind>();
    expectTypeOf<typeof API.Kind.Number>().toEqualTypeOf<'Number'>();
  });

  it('should type error codes as plain text', () => {
    expectTypeOf<'CIRCULAR_DEPENDENCY'>().toExtend<API.FormulaErrorCode>();
    expectTypeOf<typeof API.FormulaErrorCode.CIRCULAR_DEPENDENCY>().toEqualTypeOf<'CIRCULAR_DEPENDENCY'>();
    expectTypeOf<API.FormulaError['code']>().toEqualTypeOf<API.FormulaErrorCode>();
  });
});
