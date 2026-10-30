import type { FormulaDiagnostic, FormulaField, FormulaLanguage } from 'evalex/language';
import type { Node, NodeSpec } from 'prosemirror-model';
import type { Plugin, Transaction } from 'prosemirror-state';

import type * as API from '../index';

describe('@evalexjs/prosemirror API', () => {
  it('should make the plugins from the options of the formulas', () => {
    expectTypeOf<typeof API.formula>().toEqualTypeOf<(options: API.FormulaOptions) => Plugin[]>();
  });

  it('should mark a transaction that makes the formulas read their fields again', () => {
    expectTypeOf<typeof API.refreshFormulas>().toEqualTypeOf<(transaction: Transaction) => Transaction>();
  });

  it('should give the formula nodes as specs to add to a schema', () => {
    expectTypeOf<typeof API.formulaNodes>().toExtend<Readonly<Record<'formula' | 'formulaBlock' | 'formulaField', NodeSpec>>>();
  });

  it('should take the language service, the fields of every formula or of each, and the wording of errors as options', () => {
    expectTypeOf<API.FormulaOptions['language']>().toEqualTypeOf<FormulaLanguage>();
    expectTypeOf<API.FormulaOptions['fields']>().toEqualTypeOf<
      readonly FormulaField[] | ((formula: { readonly node: Node; readonly pos: number }) => readonly FormulaField[] | undefined) | undefined
    >();
    expectTypeOf<API.FormulaOptions['message']>().toEqualTypeOf<((diagnostic: FormulaDiagnostic) => string) | undefined>();
    expectTypeOf<{ language: FormulaLanguage }>().toExtend<API.FormulaOptions>();
  });
});
