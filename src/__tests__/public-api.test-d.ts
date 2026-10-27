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

  it('should type a syntax error with the location it points at', () => {
    expectTypeOf<API.SyntaxError>().toExtend<globalThis.SyntaxError>();
    expectTypeOf<API.SyntaxError['location']['start']['offset']>().toEqualTypeOf<number>();
  });

  it('should type the evaluator, its options and the view it gives back', () => {
    expectTypeOf<API.FormulaScope['evaluator']>().parameters.toEqualTypeOf<[options?: API.FormulaEvaluatorOptions]>();
    expectTypeOf<API.FormulaScope['evaluator']>().returns.toEqualTypeOf<API.FormulaEvaluator>();
    expectTypeOf<API.FormulaView<{ cost: API.Formula }>>().toEqualTypeOf<{ cost: API.FormulaCell }>();
    expectTypeOf<API.FormulaCell>().toEqualTypeOf<API.FormulaValue | API.FormulaError | API.SyntaxError>();
    expectTypeOf<API.FormulaEvaluatorOptions['cell']>().toEqualTypeOf<((value: unknown, place: API.FormulaCellPlace) => unknown) | undefined>();
  });

  it('should keep the syntax tree out of Expression', () => {
    expectTypeOf<API.Expression>().not.toHaveProperty('parse');
    expectTypeOf<API.Expression['extractDependencies']>().parameters.toEqualTypeOf<[]>();
  });
});
