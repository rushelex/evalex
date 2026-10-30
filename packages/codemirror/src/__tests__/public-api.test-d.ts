import type { Extension } from '@codemirror/state';
import type { FormulaDiagnostic, FormulaField, FormulaLanguage } from 'evalex/language';

import type * as API from '../index';

describe('@evalexjs/codemirror API', () => {
  it('should make an extension from the options of the formula', () => {
    expectTypeOf<typeof API.formula>().toEqualTypeOf<(options: API.FormulaOptions) => Extension>();
  });

  it('should take the language service, the fields and the wording of errors as options', () => {
    expectTypeOf<API.FormulaOptions['language']>().toEqualTypeOf<FormulaLanguage>();
    expectTypeOf<API.FormulaOptions['fields']>().toEqualTypeOf<readonly FormulaField[] | undefined>();
    expectTypeOf<API.FormulaOptions['message']>().toEqualTypeOf<((diagnostic: FormulaDiagnostic) => string) | undefined>();
    expectTypeOf<{ language: FormulaLanguage }>().toExtend<API.FormulaOptions>();
  });
});
