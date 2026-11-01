import type { FormulaError } from '../core/errors';
import type { FormulaErrorPayloads } from '../core/errors/error-payloads';
import type { FormulaRoutine, FormulaRoutineParameter } from '../core/formula-routine';
import type { FormulaScope } from '../core/formula-scope';
import type { FormulaType } from '../core/types';
import type { FormulaField } from '../core/types/formula-field';
import type { FormulaTokenKind } from '../parser/ast/token';
import type { CallSite } from '../parser/grammar/call-site';
import type { CaretPlace } from '../parser/grammar/caret-place';
import type { SyntaxError } from '../parser/grammar/syntax-error';
import type { SyntaxErrorCode } from '../parser/grammar/syntax-error-code';
import type { FormulaCompletion } from './formula-completion';
import type { FormulaCompletions } from './formula-completions';
import type { FormulaDiagnostic } from './formula-diagnostic';
import type { FormulaHover } from './formula-hover';
import type { FormulaSegment } from './formula-segment';
import type { FormulaSignatureHelp } from './formula-signature-help';
import type { NamePlace } from './name-place';

import { checkFormula } from '../core/check-formula';
import { Kind } from '../core/data-types';
import { DependencyExtractorVisitor } from '../core/dependency-extractor.visitor';
import { FormulaErrorCode } from '../core/errors';
import { inferNodeTypes } from '../core/infer-node-types';
import { inferType } from '../core/infer-type';
import { kindsOf, membersOf, type } from '../core/types';
import { findCalls, findCaretPlace, diagnose as findSyntaxErrors, parsePastErrors, tokenize } from '../parser/grammar/parser';
import { SYNTAX_ERROR_MESSAGES } from '../parser/grammar/syntax-error-messages';
import { findNames } from './find-names';
import { spellingDistance } from './spelling-distance';

// What can stand in place of each kind of name that is not defined: a record reads a field by a method name
const SUGGESTED_KINDS: Readonly<Record<FormulaErrorPayloads['REFERENCE_ERROR']['referenceType'], readonly FormulaCompletion['kind'][]>> = {
  variable: ['variable', 'field'],
  function: ['function'],
  method: ['method'],
  field: ['method', 'field'],
};

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
   * methods that do not exist, fields a record does not have, arguments a routine and operands an operator does not
   * take. Each is found where evaluation fails on it whenever it gets there, also inside a branch of `? :` or an
   * expression evaluated per item, which evaluation may skip. An error that depends on the values rather than their
   * types, such as a read of an empty value or a division by zero, is left to evaluation. Names are checked only when the host passes `fields`, and not inside `parent`,
   * which reads the enclosing object. A name the formula cannot read comes with `suggestions`: the names spelled like
   * it that can stand there.
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
    return checkFormula({ text, fields }).flatMap((error) => {
      const { code, payload, message, messageKey, location } = error;
      const suggestions = this.#suggestionsFor({ text, error, fields: options.fields ?? [] });
      const diagnostic = { code, payload, message: message.replace(/ \[\d+,\d+\]$/, ''), messageKey, location };

      if (!location) {
        return [];
      }

      return [suggestions ? { ...diagnostic, location, suggestions } : { ...diagnostic, location }];
    });
  }

  /** The names completion offers in place of a name that is not defined, spelled close enough to be meant by it. */
  #suggestionsFor({ text, error, fields }: { text: string; error: FormulaError; fields: readonly FormulaField[] }): FormulaCompletions | undefined {
    if (!isReferenceError(error) || !error.location) {
      return undefined;
    }

    const { name, referenceType } = error.payload;
    // A name starts where the call of a function that is not defined starts
    const completions = this.complete(text, error.location.start.offset + name.length, { fields });
    const candidates = uniqueBy(completions?.items.filter(({ kind }) => SUGGESTED_KINDS[referenceType].includes(kind)) ?? [], ({ text: candidate }) => candidate);
    const close = candidates
      .map((item) => ({ item, distance: Math.min(spellingDistance({ typed: name, meant: item.text }), spellingDistance({ typed: name, meant: item.label })) }))
      .filter(({ distance }) => distance <= Math.floor(name.length * 0.4))
      .toSorted((left, right) => left.distance - right.distance);

    return completions && close.length > 0 ? { from: completions.from, to: completions.to, items: close.map(({ item }) => item) } : undefined;
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
   * `from` to the caret, matching the `label` of each item. A chosen item replaces that text with its `text` and puts
   * the caret at its `caret`: a function or a method inserts its call, or only its name where parentheses already follow.
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
   * items.find(({ kind }) => kind === 'field');        // { kind: 'field', label: 'Price', text: 'price', caret: 5 }
   * items.find(({ label }) => label === 'max');        // { kind: 'function', label: 'max', text: 'max()', caret: 4, … }
   * ```
   */
  complete(text: string, offset: number, options: { readonly fields?: readonly FormulaField[] } = {}): FormulaCompletions | undefined {
    const place = findCaretPlace(text, offset);
    const items = place && this.#itemsAt({ place, offset, fields: options.fields ?? [], called: text[place.to] === '(' });

    if (!place || !items || items.length === 0) {
      return undefined;
    }

    return { from: place.from, to: place.to, items };
  }

  /**
   * Returns the type of what a formula evaluates to on the host's data, to show next to its result.
   *
   * @remarks
   * The type covers every value the formula can give on records whose fields have the types the host passes, so it is
   * wider where the formula alone does not tell: a field without a type, a name that is not a field, and a routine that
   * reads its arguments itself, such as `if`, hold any value.
   *
   * @param text - Formula text, as a host passes it to `FormulaScope.evaluate`.
   * @param options - What the host knows about the place of the formula.
   * @param options.fields - The fields the formula can read at its place in the host's data, with their types when the
   * host knows them.
   * @returns `undefined` for text that does not parse.
   *
   * @example
   * ```ts
   * language.typeOf('lines.map(current.qty())', { fields: [{ name: 'lines', type: { kind: 'Array', items: line } }] });
   * // { kind: 'Array', items: { kind: 'Number' } }, when `qty` of `line` is a number
   * ```
   */
  typeOf(text: string, options: { readonly fields?: readonly FormulaField[] } = {}): FormulaType | undefined {
    const formula = findSyntaxErrors(text).length > 0 ? undefined : parsePastErrors(text);

    return formula && inferType({ formula, fields: typesOf(options.fields ?? []) });
  }

  /**
   * Returns the names of the fields a formula reads, each once, in the order it first reads them.
   *
   * @remarks
   * The names a formula declares with `let` and the names a routine gives an expression per item, such as `current`,
   * are not fields. Neither are the names inside `parent(…)`, which reads them in the enclosing object. Text that does
   * not parse gives the fields read in the parts that do, so the list follows the formula as it is typed.
   *
   * @param text - Formula text, complete or still being typed.
   * @returns Every name the formula reads that a host must supply, whether or not it is one of the host's fields.
   *
   * @example
   * ```ts
   * language.reads('let net = price * qty in lines.map(current.total()).sum() + net'); // ['price', 'qty', 'lines']
   * ```
   */
  reads(text: string): string[] {
    const formula = parsePastErrors(text);

    return formula ? [...DependencyExtractorVisitor.getDependencies(formula)] : [];
  }

  /** `called` tells that parentheses follow the text the items replace. */
  #itemsAt({ place, offset, fields, called }: { place: CaretPlace; offset: number; fields: readonly FormulaField[]; called: boolean }): FormulaCompletion[] {
    if (place.kind === 'method') {
      return this.#memberItems({ place, fields, called });
    }

    const [innermost] = place.calls;

    if (place.kind === 'string') {
      const choices = innermost ? this.#parametersAt(innermost, offset).flatMap(({ choices }) => choices ?? []) : [];

      return unique(choices).map((choice) => ({ kind: 'choice', label: choice, text: choice, caret: choice.length }));
    }

    const callbackVariables = place.calls.flatMap((call) => this.#parametersAt(call, offset).flatMap(({ variables }) => variables ?? []));

    return [
      ...unique([...callbackVariables, ...place.variables]).map((name): FormulaCompletion => ({ kind: 'variable', label: name, text: name, caret: name.length })),
      ...fields.map(fieldItem),
      ...this.#routineItems({ form: 'function', called }),
    ];
  }

  /** The fields of the records and the methods of the kinds the value before the dot may have. */
  #memberItems({ place: { formula, method }, fields, called }: { place: CaretPlace; fields: readonly FormulaField[]; called: boolean }): FormulaCompletion[] {
    const call = formula && method && nameAt({ places: findNames(formula), offset: method.location.start.offset });
    const subject = formula && call?.subject ? inferNodeTypes({ formula, fields: typesOf(fields), nodes: [call.subject] }).get(call.subject)?.type ?? type.any : type.any;

    return [
      ...uniqueBy(recordFieldsOf(subject), ({ name }) => name).map(fieldItem),
      ...this.#routineItems({ form: 'method', called }).filter(({ routine }) => routine && takes({ routine, subject })),
    ];
  }

  /**
   * Returns what the name at the caret stands for, for a tooltip: a field with its label and type, a variable with its
   * type, or the routines a call may run with the type of its result.
   *
   * @remarks
   * A method name gives the methods of the types the value before the dot may have, as the types of the fields tell; a
   * value of unknown type gives every method of the name. A method name a record reads as its field gives the field.
   * Never throws, whatever the text.
   *
   * @param text - Formula text, complete or still being typed.
   * @param offset - Offset of the caret in `text`; the end of a name counts as in it.
   * @param options - What the host knows about the place of the formula.
   * @param options.fields - The fields the formula can read at its place in the host's data, with their types when the
   * host knows them; a name outside them gives nothing. Without them, any name is a field of any value.
   * @returns `undefined` where no name stands, such as in a literal or an operator, and at a name, function or method
   * the formula cannot read.
   *
   * @example
   * ```ts
   * const hover = language.hover('round(price, 2)', 8, { fields: [{ name: 'price', label: 'Price', type: { kind: 'Number' } }] });
   *
   * [hover?.kind, hover?.label, hover?.type]; // ['field', 'Price', { kind: 'Number' }]
   * language.hover('round(price, 2)', 2)?.routines?.[0]?.description; // the description of `round`
   * ```
   */
  hover(text: string, offset: number, options: { readonly fields?: readonly FormulaField[] } = {}): FormulaHover | undefined {
    return this.names(text, options).find(({ from, to }) => from <= offset && offset <= to);
  }

  /**
   * Returns every name of the formula with what it stands for, as `hover` tells each, in the order of the text: for
   * showing each field by its label at once.
   *
   * @remarks
   * Reads the formula once however many names it has, so it costs about what one `hover` does. A name `hover` tells
   * nothing of, such as a name outside the fields or a function the scope does not have, is left out. Never throws,
   * whatever the text.
   *
   * @param text - Formula text, complete or still being typed.
   * @param options - What the host knows about the place of the formula.
   * @param options.fields - The fields the formula can read at its place in the host's data, with their types when the
   * host knows them; a name outside them is left out. Without them, any name is a field of any value.
   * @returns Empty for text without such names.
   *
   * @example
   * ```ts
   * const fields = [{ name: 'price', label: 'Price' }, { name: 'qty', label: 'Quantity' }];
   *
   * language.names('round(price * qty, 2)', { fields }).map(({ kind, label, from, to }) => [kind, label, from, to]);
   * // [['function', 'round', 0, 5], ['field', 'Price', 6, 11], ['field', 'Quantity', 14, 17]]
   * ```
   */
  names(text: string, options: { readonly fields?: readonly FormulaField[] } = {}): FormulaHover[] {
    const formula = parsePastErrors(text);

    if (!formula) {
      return [];
    }

    const places = findNames(formula);
    const types = inferNodeTypes({ formula, fields: typesOf(options.fields ?? []), nodes: places.flatMap(({ value, subject }) => (subject ? [value, subject] : [value])) });

    return places.flatMap((place) => this.#hoverOf({ place, types, fields: options.fields }) ?? []);
  }

  /**
   * Splits formula text into pieces to show it without an editor, as in a cell or a list: each token with its kind, and
   * each field with the label to show in place of its name.
   *
   * @remarks
   * A name is a field where `names` tells it is one, so a variable named like a field is not, and a field of a record
   * read by a method name is. Whitespace between tokens is a piece without a kind. A field read past a syntax error is a
   * piece of the `invalid` text, with its label. A name that is not a field, such as one the host no longer gives, is a
   * piece with the span `diagnose` gives its error. Never throws, whatever the text.
   *
   * @param text - Formula text, complete or still being typed.
   * @param options - What the host knows about the place of the formula.
   * @param options.fields - The fields the formula can read at its place in the host's data, with their labels. Without
   * them no piece is a field.
   * @returns Pieces in the order of the text, whose texts make up the formula; empty for empty text.
   *
   * @example
   * ```ts
   * const fields = [{ name: 'price', label: 'Price' }, { name: 'qty', label: 'Quantity' }];
   *
   * language.segments('round(price * qty, 2)', { fields }).slice(0, 4);
   * // [{ text: 'round', from: 0, to: 5, kind: 'function' }, { text: '(', from: 5, to: 6, kind: 'punctuation' },
   * //  { text: 'price', from: 6, to: 11, kind: 'name', field: { name: 'price', label: 'Price' } },
   * //  { text: ' ', from: 11, to: 12 }]
   * ```
   */
  segments(text: string, options: { readonly fields?: readonly FormulaField[] } = {}): FormulaSegment[] {
    // Without the fields of the host any name is a field, so none is shown as one
    const fields = options.fields ? this.names(text, options).filter(({ kind }) => kind === 'field') : [];
    const segments: FormulaSegment[] = [];
    let offset = 0;

    for (const { kind, location: { start, end } } of tokenize(text)) {
      if (offset < start.offset) {
        segments.push({ text: text.slice(offset, start.offset), from: offset, to: start.offset });
      }

      segments.push(...piecesOf({ text, kind, from: start.offset, to: end.offset, fields }));
      offset = end.offset;
    }

    if (offset < text.length) {
      segments.push({ text: text.slice(offset), from: offset, to: text.length });
    }

    return segments;
  }

  /** What one name stands for, from the types of the nodes of its formula. */
  #hoverOf({ place, types, fields }: { place: NamePlace; types: ReturnType<typeof inferNodeTypes>; fields: readonly FormulaField[] | undefined }): FormulaHover | undefined {
    const { name, location } = place.name;
    const { type: valueType, declared } = types.get(place.value) ?? { type: type.any, declared: false };
    const hover = { from: location.start.offset, to: location.end.offset, label: name, type: valueType };

    if (place.role === 'function') {
      const routines = this.#routines.filter((routine) => routine.name === name && routine.form === 'function');

      return routines.length > 0 ? { ...hover, kind: 'function', routines } : undefined;
    }

    if (place.role === 'method') {
      const subject = (place.subject && types.get(place.subject)?.type) ?? type.any;
      const routines = this.#routines.filter((routine) => routine.name === name && routine.form === 'method' && takes({ routine, subject }));
      const field = recordFieldsOf(subject).find((candidate) => candidate.name === name);

      if (routines.length > 0) {
        return { ...hover, kind: 'method', routines };
      }

      return field && { ...hover, kind: 'field', label: field.label ?? name };
    }

    if (place.role === 'declaration' || declared) {
      return { ...hover, kind: 'variable' };
    }

    const field = fields ? fields.find((candidate) => candidate.name === name) : { name };

    return field && { ...hover, kind: 'field', label: field.label ?? name };
  }

  #routineItems({ form, called }: { form: FormulaRoutine['form']; called: boolean }): FormulaCompletion[] {
    return this.#routines.filter((routine) => routine.form === form).map((routine) => ({ kind: form, label: routine.name, ...callOf({ routine, called }), routine }));
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

/** The pieces of one token, with the fields inside it apart, as an `invalid` token holds them past a syntax error. */
function piecesOf({ text, kind, from, to, fields }: { text: string; kind: FormulaTokenKind; from: number; to: number; fields: readonly FormulaHover[] }): FormulaSegment[] {
  const pieces: FormulaSegment[] = [];
  let offset = from;

  for (const field of fields.filter((name) => from <= name.from && name.to <= to)) {
    const name = text.slice(field.from, field.to);

    if (offset < field.from) {
      pieces.push({ text: text.slice(offset, field.from), from: offset, to: field.from, kind });
    }

    pieces.push({ text: name, from: field.from, to: field.to, kind, field: { name, label: field.label } });
    offset = field.to;
  }

  if (offset < to) {
    pieces.push({ text: text.slice(offset, to), from: offset, to, kind });
  }

  return pieces;
}

function nameAt({ places, offset }: { places: readonly NamePlace[]; offset: number }): NamePlace | undefined {
  return places.find(({ name: { location } }) => location.start.offset <= offset && offset <= location.end.offset);
}

function isReferenceError(error: FormulaError): error is FormulaError<'REFERENCE_ERROR'> {
  return error.code === FormulaErrorCode.REFERENCE_ERROR;
}

/** The types of the fields the host gives one; a field without a type holds any value. */
function typesOf(fields: readonly FormulaField[]): Map<string, FormulaType> {
  return new Map(fields.flatMap(({ name, type: fieldType }) => (fieldType ? [[name, fieldType] as const] : [])));
}

/** The fields of the records a value of `subject` may be. */
function recordFieldsOf(subject: FormulaType): FormulaField[] {
  return membersOf(subject).flatMap((member) => (member.kind === Kind.Object ? member.fields ?? [] : []));
}

function fieldItem({ name, label }: FormulaField): FormulaCompletion {
  return { kind: 'field', label: label ?? name, text: name, caret: name.length };
}

/** What completion inserts for a routine: its name where parentheses follow, otherwise a call with no arguments yet. */
function callOf({ routine: { name, signatures }, called }: { routine: FormulaRoutine; called: boolean }): Pick<FormulaCompletion, 'text' | 'caret'> {
  if (called) {
    return { text: name, caret: name.length };
  }

  // A routine with no signatures checks its arguments itself, as `if` does, and takes some
  const takesArguments = signatures.length === 0 || signatures.some(({ parameters }) => parameters.length > 0);

  return { text: `${name}()`, caret: takesArguments ? name.length + 1 : name.length + 2 };
}

/** Tells whether a method may be called on a value of `subject`; a value of any type takes every method. */
function takes({ routine, subject }: { routine: FormulaRoutine; subject: FormulaType }): boolean {
  const kinds = kindsOf(subject);

  return kinds.includes(Kind.Any) || routine.kinds.some((kind) => kinds.includes(kind));
}

function syntaxDiagnostic<C extends SyntaxErrorCode>({ code, payload, messageKey, location }: SyntaxError<C>): FormulaDiagnostic {
  return { code, payload, message: SYNTAX_ERROR_MESSAGES[code](payload), messageKey, location };
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
