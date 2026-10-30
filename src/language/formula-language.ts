import type { FormulaRoutine, FormulaRoutineParameter } from '../core/formula-routine';
import type { FormulaScope } from '../core/formula-scope';
import type { FormulaField } from '../core/types/formula-field';
import type { CallSite } from '../parser/grammar/call-site';
import type { CaretPlace } from '../parser/grammar/caret-place';
import type { SyntaxError } from '../parser/grammar/syntax-error';
import type { SyntaxErrorCode } from '../parser/grammar/syntax-error-code';
import type { FormulaCompletion } from './formula-completion';
import type { FormulaCompletions } from './formula-completions';
import type { FormulaDiagnostic } from './formula-diagnostic';
import type { FormulaSignatureHelp } from './formula-signature-help';

import { checkFormula } from '../core/check-formula';
import { Kind } from '../core/data-types';
import { inferSubjectType } from '../core/infer-subject-type';
import { parseFormula } from '../core/parse-formula';
import { kindsOf, membersOf, type } from '../core/types';
import { findCalls, findCaretPlace, diagnose as findSyntaxErrors } from '../parser/grammar/parser';
import { SYNTAX_ERROR_MESSAGES } from '../parser/grammar/syntax-error-messages';

/**
 * Answers what a formula editor asks about the text being typed, with the functions and methods of a scope.
 *
 * @remarks
 * Create one per scope and reuse it on every keystroke: it reads the routines of the scope once, when it is created.
 * Its answers never throw, whatever the text.
 *
 * @example
 * ```ts
 * import { FormulaScope } from 'evalex';
 * import { FormulaLanguage } from 'evalex/language';
 *
 * const language = new FormulaLanguage(new FormulaScope());
 *
 * const help = language.signatureHelp('round(price, ', 13);
 * help?.routines[0]?.name; // 'round'
 * help?.argument;          // 1, the places to round to
 * ```
 */
export class FormulaLanguage {
  readonly #routines: readonly FormulaRoutine[];

  constructor(scope: FormulaScope) {
    this.#routines = scope.routines();
  }

  /**
   * Returns the call the caret is in and the argument it is in, for showing the arguments of the call as they are typed.
   *
   * @remarks
   * The call is the innermost one whose parentheses hold the caret, and a call not closed yet holds the rest of the
   * text it reads. Commas inside text, regular expressions, lists and inner calls do not count.
   *
   * @param text - Formula text, complete or still being typed.
   * @param offset - Offset of the caret in `text`.
   * @returns `undefined` when the caret is not inside the parentheses of a call by name, or the scope has no routine
   * of that name and form.
   */
  signatureHelp(text: string, offset: number): FormulaSignatureHelp | undefined {
    // Inner calls come first, so the first call around the caret is the innermost one
    const call = findCalls(text).find(({ open, end }) => open <= offset && offset <= end);
    const routines = call ? this.#routinesOf(call) : [];

    if (!call || routines.length === 0) {
      return undefined;
    }

    return { routines, argument: argumentAt(call, offset) };
  }

  /**
   * Finds the errors in formula text, for underlining them in an editor: the syntax errors, or when there are none, the
   * errors evaluation raises on every record whose fields have the types the host gives.
   *
   * @remarks
   * The first syntax error is the error evaluating the formula throws, so the editor and the result agree. Reading goes
   * on past errors it can step over, so separate mistakes show at once: a bad escape or a method that is not called
   * leaves the rest readable, and an error inside brackets goes on from the next argument or element. An error outside
   * any bracket ends the reading, since what follows it cannot be told apart from what caused it.
   *
   * A formula without syntax errors is checked as evaluation reads it: names that are not defined, functions and
   * methods that do not exist, fields a record does not have, and arguments a routine does not take. Each is found
   * where evaluation fails on it whenever it gets there, also inside a branch of `? :` or an expression evaluated per
   * item, which evaluation may skip. An error that depends on the values rather than their types, such as a read of an
   * empty value, is left to evaluation. Names are checked only when the host passes `fields`, and not inside `parent`,
   * which reads the enclosing object.
   *
   * Never throws, so it can run on every keystroke.
   *
   * @param text - Formula text, as a host passes it to `FormulaScope.evaluate`.
   * @param options - What the host knows about the place of the formula.
   * @param options.fields - Every field the formula can read at its place in the host's data, with their types when the
   * host knows them.
   * @returns The diagnostics in the order of the text; empty when evaluation can fail only on the values.
   *
   * @example
   * ```ts
   * language.diagnose('round(price,, 2) + max(1 2)').map(({ code, location }) => [code, location.start.offset]);
   * // [['MISSING_ARGUMENT', 11], ['UNCLOSED_PARENTHESIS', 22]]
   *
   * language.diagnose('title.round() + totl', { fields: [{ name: 'title', type: { kind: 'String' } }] })
   *   .map(({ messageKey }) => messageKey);
   * // ['formula_error.method_not_defined', 'formula_error.variable_not_defined']
   * ```
   */
  diagnose(text: string, options: { readonly fields?: readonly FormulaField[] } = {}): FormulaDiagnostic[] {
    const syntaxErrors = findSyntaxErrors(text);

    if (syntaxErrors.length > 0) {
      return syntaxErrors.map((error) => syntaxDiagnostic(error));
    }

    const fields = options.fields && new Map(options.fields.map(({ name, type: fieldType }) => [name, fieldType ?? type.any]));

    // Every error a check finds points into the formula
    return checkFormula({ formula: parseFormula(text), fields }).flatMap(({ code, payload, message, messageKey, location }) => (location
      ? [{ code, payload, message: message.replace(/ \[\d+,\d+\]$/, ''), messageKey, location }]
      : []));
  }

  /**
   * Returns what can be typed at the caret, for a completion list.
   *
   * @remarks
   * Where a value goes, the items are the variables the formula declares around the caret, then the fields, then the
   * functions. After a dot they are the fields of a record, then the methods of every type the value before the dot may
   * have, as the types of the fields tell; a value of unknown type gets every method. Inside quotes they are the words
   * the argument takes, such as the units of `dateBetween`.
   *
   * Every item that can be typed there is given, whatever is typed already: the editor narrows the list by the text from
   * `from` to the caret, matching the `label` of each item.
   *
   * @param text - Formula text, complete or still being typed.
   * @param offset - Offset of the caret in `text`.
   * @param options - What the host knows about the place of the formula.
   * @param options.fields - The fields the formula can read at its place in the host's data, with their types when the
   * host knows them.
   * @returns `undefined` where nothing can be typed, such as right after a value or inside a number.
   *
   * @example
   * ```ts
   * const { from, to, items } = language.complete('round(pr', 8, { fields: [{ name: 'price', label: 'Price' }] })!;
   *
   * [from, to];                                        // [6, 8], the text `pr`
   * items.find(({ kind }) => kind === 'field');        // { kind: 'field', label: 'Price', text: 'price' }
   * ```
   */
  complete(text: string, offset: number, options: { readonly fields?: readonly FormulaField[] } = {}): FormulaCompletions | undefined {
    const place = findCaretPlace(text, offset);
    const items = place && this.#itemsAt({ place, offset, fields: options.fields ?? [] });

    if (!place || !items || items.length === 0) {
      return undefined;
    }

    return { from: place.from, to: place.to, items };
  }

  #itemsAt({ place, offset, fields }: { place: CaretPlace; offset: number; fields: readonly FormulaField[] }): FormulaCompletion[] {
    if (place.kind === 'method') {
      return this.#memberItems({ place, fields });
    }

    const [innermost] = place.calls;

    if (place.kind === 'string') {
      const choices = innermost ? this.#parametersAt(innermost, offset).flatMap(({ choices }) => choices ?? []) : [];

      return unique(choices).map((choice) => ({ kind: 'choice', label: choice, text: choice }));
    }

    const callbackVariables = place.calls.flatMap((call) => this.#parametersAt(call, offset).flatMap(({ variables }) => variables ?? []));

    return [
      ...unique([...callbackVariables, ...place.variables]).map((name): FormulaCompletion => ({ kind: 'variable', label: name, text: name })),
      ...fields.map(({ name, label }): FormulaCompletion => ({ kind: 'field', label: label ?? name, text: name })),
      ...this.#routineItems('function'),
    ];
  }

  /** The fields of the records and the methods of the kinds the value before the dot may have. */
  #memberItems({ place: { formula, method }, fields }: { place: CaretPlace; fields: readonly FormulaField[] }): FormulaCompletion[] {
    const types = new Map(fields.flatMap(({ name, type: fieldType }) => (fieldType ? [[name, fieldType] as const] : [])));
    const subject = formula && method ? inferSubjectType({ formula, fields: types, method }) : type.any;
    const kinds = kindsOf(subject);
    const recordFields = membersOf(subject).flatMap((member) => (member.kind === Kind.Object ? member.fields ?? [] : []));
    const takes = (routine: FormulaRoutine) => kinds.includes(Kind.Any) || routine.kinds.some((kind) => kinds.includes(kind));

    return [
      ...uniqueBy(recordFields, ({ name }) => name).map(({ name, label }): FormulaCompletion => ({ kind: 'field', label: label ?? name, text: name })),
      ...this.#routineItems('method').filter(({ routine }) => routine && takes(routine)),
    ];
  }

  #routineItems(form: FormulaRoutine['form']): FormulaCompletion[] {
    return this.#routines.filter((routine) => routine.form === form).map((routine) => ({ kind: form, label: routine.name, text: routine.name, routine }));
  }

  #routinesOf(call: CallSite): FormulaRoutine[] {
    return this.#routines.filter(({ name, form }) => name === call.name && form === call.form);
  }

  /** The parameters the argument at the caret can be, over every signature of every routine the call may run. */
  #parametersAt(call: CallSite, offset: number): FormulaRoutineParameter[] {
    const argument = argumentAt(call, offset);

    return this.#routinesOf(call).flatMap(({ signatures }) => signatures.map(({ parameters }) => {
      const last = parameters.at(-1);

      return parameters[argument] ?? (last?.repeatable ? last : undefined);
    })).filter((parameter) => parameter !== undefined);
  }
}

function syntaxDiagnostic<C extends SyntaxErrorCode>({ code, payload, location }: SyntaxError<C>): FormulaDiagnostic {
  return { code, payload, message: SYNTAX_ERROR_MESSAGES[code](payload), location };
}

function argumentAt(call: CallSite, offset: number): number {
  return call.commas.filter((comma) => comma < offset).length;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/** The values with the first of each key, in their order. */
function uniqueBy<T>(values: readonly T[], keyOf: (value: T) => string): T[] {
  return [...new Map(values.toReversed().map((value) => [keyOf(value), value])).values()].toReversed();
}
