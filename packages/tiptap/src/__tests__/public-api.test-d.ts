import type { FormulaOptions } from '@evalexjs/prosemirror';
import type { Extension } from '@tiptap/core';

import type * as API from '../index';

describe('@evalexjs/tiptap API', () => {
  it('should give one extension, configured with the options of the ProseMirror formula plugins', () => {
    expectTypeOf<typeof API.FormulaKit>().toEqualTypeOf<Extension<FormulaOptions, Record<string, never>>>();
    expectTypeOf<Parameters<typeof API.FormulaKit.configure>[0]>().toEqualTypeOf<Partial<FormulaOptions> | undefined>();
  });
});
