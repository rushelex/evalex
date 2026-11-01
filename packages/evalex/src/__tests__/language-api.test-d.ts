import type * as Root from '../index';
import type * as API from '../language';

describe('language API', () => {
  it('should type tokens with their kind and the location the root API uses', () => {
    expectTypeOf<typeof API.tokenize>().toEqualTypeOf<(text: string) => API.FormulaToken[]>();
    expectTypeOf<API.FormulaToken['kind']>().toEqualTypeOf<API.FormulaTokenKind>();
    expectTypeOf<API.FormulaToken['location']>().toEqualTypeOf<Root.FormulaLocation>();
  });

  it('should type diagnostics with the code, payload and location of a syntax error or a formula error', () => {
    expectTypeOf<API.FormulaLanguage['diagnose']>().toEqualTypeOf<(text: string, options?: { readonly fields?: readonly API.FormulaField[] }) => API.FormulaDiagnostic[]>();
    expectTypeOf<API.FormulaDiagnostic['code']>().toEqualTypeOf<Root.SyntaxErrorCode | Root.FormulaErrorCode>();
    expectTypeOf<API.FormulaDiagnostic<'UNEXPECTED_CHARACTER'>['payload']>().toEqualTypeOf<Root.SyntaxErrorPayloads['UNEXPECTED_CHARACTER']>();
    expectTypeOf<API.FormulaDiagnostic<'REFERENCE_ERROR'>['payload']>().toEqualTypeOf<Root.FormulaErrorPayloads['REFERENCE_ERROR']>();
    expectTypeOf<API.FormulaDiagnostic['messageKey']>().toEqualTypeOf<string>();
    expectTypeOf<API.FormulaDiagnostic['location']>().toEqualTypeOf<Root.FormulaLocation>();
    expectTypeOf<API.FormulaDiagnostic['message']>().toEqualTypeOf<string>();
    expectTypeOf<API.FormulaDiagnostic['suggestions']>().toEqualTypeOf<API.FormulaCompletions | undefined>();
  });

  it('should type the result of a formula with the type of the root API', () => {
    expectTypeOf<API.FormulaLanguage['typeOf']>().toEqualTypeOf<(text: string, options?: { readonly fields?: readonly API.FormulaField[] }) => Root.FormulaType | undefined>();
  });

  it('should list the fields a formula reads by their names', () => {
    expectTypeOf<API.FormulaLanguage['reads']>().toEqualTypeOf<(text: string) => string[]>();
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
    expectTypeOf<API.FormulaCompletion['caret']>().toEqualTypeOf<number>();
    expectTypeOf<{ name: 'price' }>().toExtend<API.FormulaField>();
  });

  it('should type hover with the fields the host passes and the types and routines of the root API', () => {
    expectTypeOf<API.FormulaLanguage['hover']>().toEqualTypeOf<
      (text: string, offset: number, options?: { readonly fields?: readonly API.FormulaField[] }) => API.FormulaHover | undefined
    >();
    expectTypeOf<API.FormulaHover['type']>().toEqualTypeOf<Root.FormulaType>();
    expectTypeOf<API.FormulaHover['routines']>().toEqualTypeOf<readonly Root.FormulaRoutine[] | undefined>();
  });

  it('should type names as the hover of every name', () => {
    expectTypeOf<API.FormulaLanguage['names']>().toEqualTypeOf<
      (text: string, options?: { readonly fields?: readonly API.FormulaField[] }) => API.FormulaHover[]
    >();
  });

  it('should type segments with the token kinds and the fields by their labels', () => {
    expectTypeOf<API.FormulaLanguage['segments']>().toEqualTypeOf<
      (text: string, options?: { readonly fields?: readonly API.FormulaField[] }) => API.FormulaSegment[]
    >();
    expectTypeOf<API.FormulaSegment['from']>().toEqualTypeOf<number>();
    expectTypeOf<API.FormulaSegment['kind']>().toEqualTypeOf<API.FormulaTokenKind | undefined>();
    expectTypeOf<API.FormulaSegment['field']>().toEqualTypeOf<{ readonly name: string; readonly label: string } | undefined>();
  });

  it('should type token kinds as plain text', () => {
    expectTypeOf<'function'>().toExtend<API.FormulaTokenKind>();
    expectTypeOf<'invalid'>().toExtend<API.FormulaTokenKind>();
  });
});
