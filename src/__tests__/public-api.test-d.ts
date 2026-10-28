import type * as API from '../index';

describe('public API', () => {
  it('should type kinds as plain text', () => {
    expectTypeOf<'Number'>().toExtend<API.Kind>();
    expectTypeOf<typeof API.Kind.Number>().toEqualTypeOf<'Number'>();
  });

  it('should export the data type classes as the types a result narrows to by its kind', () => {
    expectTypeOf<Extract<API.FormulaValue, { kind: 'Number' }>>().toEqualTypeOf<API.FormulaNumber>();
    expectTypeOf<Extract<API.FormulaValue, { kind: 'DateRange' }>>().toEqualTypeOf<API.FormulaDateRange>();
  });

  it('should type error codes as plain text', () => {
    expectTypeOf<'CIRCULAR_REFERENCE'>().toExtend<API.FormulaErrorCode>();
    expectTypeOf<typeof API.FormulaErrorCode.CIRCULAR_REFERENCE>().toEqualTypeOf<'CIRCULAR_REFERENCE'>();
    expectTypeOf<API.FormulaError['code']>().toEqualTypeOf<API.FormulaErrorCode>();
  });

  it('should type a syntax error with the location it points at', () => {
    expectTypeOf<API.SyntaxError>().toExtend<globalThis.SyntaxError>();
    expectTypeOf<API.SyntaxError['location']['start']['offset']>().toEqualTypeOf<number>();
  });

  it('should type syntax error codes as plain text, each with its payload', () => {
    expectTypeOf<'UNEXPECTED_CHARACTER'>().toExtend<API.SyntaxErrorCode>();
    expectTypeOf<typeof API.SyntaxErrorCode.UNEXPECTED_CHARACTER>().toEqualTypeOf<'UNEXPECTED_CHARACTER'>();
    expectTypeOf<API.SyntaxError['code']>().toEqualTypeOf<API.SyntaxErrorCode>();
    expectTypeOf<API.SyntaxError<'UNEXPECTED_CHARACTER'>['payload']>().toEqualTypeOf<API.SyntaxErrorPayloads['UNEXPECTED_CHARACTER']>();
    expectTypeOf<API.SyntaxErrorPayloads['UNEXPECTED_CHARACTER']>().toEqualTypeOf<{ readonly character: string }>();
  });

  it('should name the location of every error and the payload of each code', () => {
    expectTypeOf<API.SyntaxError['location']>().toEqualTypeOf<API.FormulaLocation>();
    expectTypeOf<API.FormulaError['location']>().toEqualTypeOf<API.FormulaLocation | undefined>();
    expectTypeOf<API.FormulaError<'REFERENCE_ERROR'>['payload']>().toEqualTypeOf<API.FormulaErrorPayloads['REFERENCE_ERROR']>();
  });

  it('should type the routines of a scope with their argument lists', () => {
    expectTypeOf<API.FormulaScope['routines']>().returns.toEqualTypeOf<API.FormulaRoutine[]>();
    expectTypeOf<API.FormulaRoutine['form']>().toEqualTypeOf<'function' | 'method'>();
    expectTypeOf<API.FormulaRoutine['signatures'][number]>().toEqualTypeOf<API.FormulaRoutineSignature>();
    expectTypeOf<API.FormulaRoutineSignature['parameters'][number]>().toEqualTypeOf<API.FormulaRoutineParameter>();
    expectTypeOf<API.FormulaRoutineParameter['kinds'][number]>().toEqualTypeOf<API.Kind>();
  });

  it('should type the evaluator, its options and the view it gives back', () => {
    expectTypeOf<API.FormulaScope['evaluator']>().parameters.toEqualTypeOf<[options?: API.FormulaEvaluatorOptions]>();
    expectTypeOf<API.FormulaScope['evaluator']>().returns.toEqualTypeOf<API.FormulaEvaluator>();
    expectTypeOf<API.FormulaView<{ cost: API.Formula }>>().toEqualTypeOf<{ cost: API.FormulaCell }>();
    expectTypeOf<API.FormulaCell>().toEqualTypeOf<API.FormulaValue | API.FormulaError | API.SyntaxError>();
    expectTypeOf<API.FormulaEvaluatorOptions['cell']>().toEqualTypeOf<((value: unknown, place: API.FormulaCellPlace) => unknown) | undefined>();
  });
});
