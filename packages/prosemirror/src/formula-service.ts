import type { FormulaCompletions, FormulaDiagnostic, FormulaField, FormulaHover, FormulaSignatureHelp, FormulaToken } from 'evalex/language';
import type { Node } from 'prosemirror-model';

import type { FormulaOptions } from './formula-options';
import type { FormulaText } from './formula-text';

import { tokenize } from 'evalex/language';

/** What was found in one formula node with one list of fields. */
interface Found {
  readonly fields: readonly FormulaField[] | undefined;
  names?: FormulaHover[];
  diagnostics?: FormulaDiagnostic[];
}

/**
 * Answers the plugins about the formula nodes of a document with the language service and the fields of each formula.
 *
 * @remarks
 * Nodes do not change, so what is found in a node is kept with it until it is edited or the fields of its formula
 * change; a keystroke in one formula leaves the others of the document as they were.
 */
export class FormulaService {
  readonly #options: FormulaOptions;
  readonly #tokens = new WeakMap<Node, FormulaToken[]>();
  readonly #found = new WeakMap<Node, Found>();

  constructor(options: FormulaOptions) {
    this.#options = options;
  }

  /** Whether formulas have fields to check names against and to show as chips. */
  get checksNames(): boolean {
    return this.#options.fields !== undefined;
  }

  fieldsOf({ node, pos }: FormulaText): readonly FormulaField[] | undefined {
    const { fields } = this.#options;

    return typeof fields === 'function' ? fields({ node, pos }) : fields;
  }

  tokens({ node, text }: FormulaText): FormulaToken[] {
    const cached = this.#tokens.get(node);

    if (cached) {
      return cached;
    }

    const tokens = tokenize(text);

    this.#tokens.set(node, tokens);

    return tokens;
  }

  names(formula: FormulaText): FormulaHover[] {
    const found = this.#foundIn(formula);

    found.names ??= this.#options.language.names(formula.text, { fields: found.fields });

    return found.names;
  }

  diagnose(formula: FormulaText): FormulaDiagnostic[] {
    const found = this.#foundIn(formula);

    found.diagnostics ??= this.#options.language.diagnose(formula.text, { fields: found.fields });

    return found.diagnostics;
  }

  complete(formula: FormulaText, offset: number): FormulaCompletions | undefined {
    return this.#options.language.complete(formula.text, offset, { fields: this.fieldsOf(formula) });
  }

  signatureHelp(formula: FormulaText, offset: number): FormulaSignatureHelp | undefined {
    return this.#options.language.signatureHelp(formula.text, offset);
  }

  hover(formula: FormulaText, offset: number): FormulaHover | undefined {
    return this.#options.language.hover(formula.text, offset, { fields: this.fieldsOf(formula) });
  }

  message(diagnostic: FormulaDiagnostic): string {
    return this.#options.message?.(diagnostic) ?? diagnostic.message;
  }

  #foundIn(formula: FormulaText): Found {
    const fields = this.fieldsOf(formula);
    const cached = this.#found.get(formula.node);

    if (cached && cached.fields === fields) {
      return cached;
    }

    const found: Found = { fields };

    this.#found.set(formula.node, found);

    return found;
  }
}
