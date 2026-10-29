import type * as Root from '../index';
import type * as API from '../language';

describe('language API', () => {
  it('should type tokens with their kind and the location the root API uses', () => {
    expectTypeOf<typeof API.tokenize>().toEqualTypeOf<(text: string) => API.FormulaToken[]>();
    expectTypeOf<API.FormulaToken['kind']>().toEqualTypeOf<API.FormulaTokenKind>();
    expectTypeOf<API.FormulaToken['location']>().toEqualTypeOf<Root.FormulaLocation>();
  });

  it('should type diagnostics with the code, payload and location of a syntax error', () => {
    expectTypeOf<typeof API.diagnose>().toEqualTypeOf<(text: string) => API.FormulaDiagnostic[]>();
    expectTypeOf<API.FormulaDiagnostic['code']>().toEqualTypeOf<Root.SyntaxErrorCode>();
    expectTypeOf<API.FormulaDiagnostic<'UNEXPECTED_CHARACTER'>['payload']>().toEqualTypeOf<Root.SyntaxErrorPayloads['UNEXPECTED_CHARACTER']>();
    expectTypeOf<API.FormulaDiagnostic['location']>().toEqualTypeOf<Root.FormulaLocation>();
    expectTypeOf<API.FormulaDiagnostic['message']>().toEqualTypeOf<string>();
  });

  it('should create the language service from a scope and type its signature help with the routines of the root API', () => {
    expectTypeOf<typeof API.FormulaLanguage>().constructorParameters.toEqualTypeOf<[scope: Root.FormulaScope]>();
    expectTypeOf<API.FormulaLanguage['signatureHelp']>().toEqualTypeOf<(text: string, offset: number) => API.FormulaSignatureHelp | undefined>();
    expectTypeOf<API.FormulaSignatureHelp['routines'][number]>().toEqualTypeOf<Root.FormulaRoutine>();
  });

  it('should type completions with the fields the host passes and the routines of the root API', () => {
    expectTypeOf<API.FormulaLanguage['complete']>().toEqualTypeOf<
      (text: string, offset: number, options?: { readonly fields?: readonly API.FormulaField[] }) => API.FormulaCompletions | undefined
    >();
    expectTypeOf<API.FormulaCompletions['items'][number]>().toEqualTypeOf<API.FormulaCompletion>();
    expectTypeOf<API.FormulaCompletion['routine']>().toEqualTypeOf<Root.FormulaRoutine | undefined>();
    expectTypeOf<{ name: 'price' }>().toExtend<API.FormulaField>();
  });

  it('should type token kinds as plain text', () => {
    expectTypeOf<'function'>().toExtend<API.FormulaTokenKind>();
    expectTypeOf<'invalid'>().toExtend<API.FormulaTokenKind>();
  });
});
