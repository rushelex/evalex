import type { FormulaDataType } from '../core/data-types';
import type { FormulaLocation } from '../parser';
import type { FormulaField } from './index';

import { fc, it } from '@fast-check/vitest';

import { FormulaObject, FormulaString } from '../core/data-types';
import { FormulaScope } from '../core/formula-scope';
import { arg } from '../core/routines/arguments';
import { routinesRegistry } from '../core/routines/registry';
import { type } from '../core/types';
import { evaluateOutcome, fieldFormulaArbitrary, formulaValueArbitrary, typeOfValue } from '../testing-library';
import { FormulaLanguage } from './index';

// No built-in routine repeats an argument that takes words, so completion of a repeated one is checked on this one.
routinesRegistry.registerRoutine('unitsProbe', {
  description: 'Returns the first unit.',
  examples: [],
  arguments: [arg.number('number'), arg.choice('units', ['days', 'hours'], { repeatable: true })],
  returns: type.string,
  handler: ({ args: [unit] }) => new FormulaString(unit.value),
});

/** A piece of generated formula text, with the call and argument the caret is in right after it. */
interface Piece {
  readonly text: string;
  readonly call: CallAtCaret | undefined;
}

interface CallAtCaret {
  readonly name: string;
  readonly form: 'function' | 'method';
  readonly argument: number;
}

// Commas inside text, regular expressions and lists are not commas of the call.
const ATOMS = ['1', 'price', '"a, b"', '/a,b/', '[1, 2]'];

const FUNCTIONS = ['round', 'max', 'upper'];

const METHODS = ['round', 'upper', 'join'];

// Pieces of calls nested in calls; the pieces of the outermost level have no call yet.
const { expression: expressionPieces } = fc.letrec<Record<string, readonly Piece[]>>((tie) => ({
  expression: fc.oneof(
    { depthSize: 'small' },
    fc.constantFrom(...ATOMS).map((text) => [{ text, call: undefined }]),
    fc.tuple(fc.constantFrom(...FUNCTIONS), fc.array(tie('expression'), { maxLength: 3 }))
      .map(([name, args]) => [{ text: name, call: undefined }, ...callPieces({ name, form: 'function', args })]),
    fc.tuple(tie('expression'), fc.constantFrom(...METHODS), fc.array(tie('expression'), { maxLength: 3 }))
      .map(([subject, name, args]) => [...subject, { text: `.${name}`, call: undefined }, ...callPieces({ name, form: 'method', args })]),
  ),
}));

// Any text built of what formulas are made of, unbalanced and unterminated included.
const formulaText = fc.string({ unit: fc.constantFrom(...'ab1 .,()[]"/\\@=+-'), maxLength: 30 })
  .chain((tail) => fc.constantFrom('', 'let a = 1 in ', 'list.filter(', 'dateBetween(a, b, "').map((head) => head + tail));

const KEYWORDS = new Set(['null', 'undefined', 'true', 'false', 'or', 'and', 'not', 'in', 'let', 'const']);

const word = fc.stringMatching(/^[a-z]\w{0,8}$/).filter((name) => !KEYWORDS.has(name));

const routines = new FormulaScope().routines();

const functionNames = routines.filter(({ form }) => form === 'function').map(({ name }) => name);

const methodNames = routines.filter(({ form }) => form === 'method').map(({ name }) => name);

const orderLine = { kind: 'Object', fields: [{ name: 'qty', label: 'Quantity', type: { kind: 'Number' } }, { name: 'sku' }] } as const;

const orderFields = [
  { name: 'title', type: { kind: 'String' } },
  { name: 'order', type: orderLine },
  { name: 'lines', type: { kind: 'Array', items: orderLine } },
] as const;

const language = new FormulaLanguage(new FormulaScope());

describe(FormulaLanguage, () => {
  describe('signatureHelp', () => {
    it.prop([expressionPieces])('should give the call and argument the caret is in after each piece of a formula', (pieces) => {
      const text = pieces.map(({ text }) => text).join('');

      expect(callsAtEachPiece({ pieces, text: () => text })).toEqual(pieces.map(({ call }) => call));
    });

    it.prop([expressionPieces])('should give the same while the formula is still being typed up to the caret', (pieces) => {
      expect(callsAtEachPiece({ pieces, text: (end) => pieces.map(({ text }) => text).join('').slice(0, end) })).toEqual(pieces.map(({ call }) => call));
    });

    it('should give the routine called and the argument being typed', () => {
      const help = language.signatureHelp('round(price, ', 13);

      expect(help?.routines.map(({ name, form, signatures }) => [name, form, signatures[0]?.parameters.map(({ name }) => name)])).toEqual([['round', 'function', ['number', 'places']]]);
      expect(help?.argument).toBe(1);
    });

    it('should give every method of the name, whatever the value before the dot', () => {
      expect(language.signatureHelp('due.add(', 8)?.routines.map(({ kinds }) => kinds)).toEqual([['Date', 'DateTime'], ['Number', 'String']]);
    });

    it.each([
      { text: 'max(round(1, ), 2)', offset: 13, expected: ['round', 1] },
      { text: 'max(round(1), 2)', offset: 12, expected: ['max', 0] },
      { text: 'max([1, 2], 3)', offset: 8, expected: ['max', 0] },
      { text: 'upper("a, b")', offset: 10, expected: ['upper', 0] },
      { text: 'max(1 @ 2, 3', offset: 12, expected: ['max', 1] },
    ])('should count only the commas of the innermost call around the caret: $text at $offset', ({ text, offset, expected }) => {
      const help = language.signatureHelp(text, offset);

      expect([help?.routines[0]?.name, help?.argument]).toEqual(expected);
    });

    it.each([
      { text: 'round(1)', offset: 5 },
      { text: 'round(1)', offset: 8 },
      { text: 'price + 1', offset: 3 },
      { text: 'unknown(1, ', offset: 11 },
    ])('should give nothing outside the parentheses of a call to a routine: $text at $offset', ({ text, offset }) => {
      expect(language.signatureHelp(text, offset)).toBeUndefined();
    });
  });

  describe('complete', () => {
    it.prop([formulaText.chain((text) => fc.tuple(fc.constant(text), fc.nat({ max: text.length })))])('should give a range around the caret inside the text, whatever the text', ([text, offset]) => {
      const completions = language.complete(text, offset);

      expect(completions === undefined || (completions.from <= offset && offset <= completions.to && completions.to <= text.length)).toBe(true);
    });

    it('should complete a method in text that calls a value, which is not a function name', () => {
      const completions = language.complete('list.filter(([+1 )(["1', 5);

      expect([completions?.from, completions?.to, completions?.items.some(({ label }) => label === 'filter')]).toEqual([5, 11, true]);
    });

    it.prop([word.chain((name) => fc.tuple(fc.constant(name), fc.nat({ max: name.length })))])('should replace the whole word the caret is in where a value goes', ([name, caret]) => {
      const completions = language.complete(`max(1, ${name})`, 7 + caret, { fields: [{ name: 'price' }] });

      expect([completions?.from, completions?.to, completions?.items.some(({ kind }) => kind === 'field')]).toEqual([7, 7 + name.length, true]);
    });

    it('should offer the variables, then the fields, then the functions where a value goes', () => {
      const completions = language.complete('let rate = 2 in round(pr', 24, { fields: [{ name: 'price', label: 'Price' }, { name: 'tax' }] });

      expect(completions && [completions.from, completions.to]).toEqual([22, 24]);
      expect(completions?.items.map(({ kind, label, text }) => [kind, label, text])).toEqual([
        ['variable', 'rate', 'rate'],
        ['field', 'Price', 'price'],
        ['field', 'tax', 'tax'],
        ...functionNames.map((name) => ['function', name, name]),
      ]);
    });

    it('should give each function with its routine', () => {
      const round = language.complete('', 0)?.items.find(({ label }) => label === 'round');

      expect(round?.routine && [round.routine.name, round.routine.form]).toEqual(['round', 'function']);
    });

    it.each([
      { text: 'due.ad', offset: 6, from: 4 },
      { text: 'due.', offset: 4, from: 4 },
      { text: 'due.round(1)', offset: 6, from: 4 },
    ])('should offer every method after a dot: $text at $offset', ({ text, offset, from }) => {
      const completions = language.complete(text, offset, { fields: [{ name: 'price' }] });

      expect(completions?.from).toBe(from);
      expect(completions?.items.map(({ kind, label }) => [kind, label])).toEqual(methodNames.map((name) => ['method', name]));
    });

    describe.each([
      { place: 'after a field', text: 'value.' },
      { place: 'after an item read per item', text: '[value].map(current.' },
    ])('$place', ({ text }) => {
      it.prop([formulaValueArbitrary()])('should offer every method and field the value before the dot has, whatever the value', (value) => {
        const offered = language.complete(text, text.length, { fields: [{ name: 'value', type: typeOfValue(value) }] })?.items.map(({ kind, text }) => [kind, text]);
        const methods = routines.filter(({ form, kinds }) => form === 'method' && kinds.includes(value.kind)).map(({ name }) => ['method', name]);
        const fields = value instanceof FormulaObject ? Object.keys(value.value).map((name) => ['field', name]) : [];

        expect(offered).toEqual(expect.arrayContaining([...fields, ...methods]));
      });
    });

    it.each([
      { text: 'title.', kinds: ['String'] },
      { text: 'let all = lines in all.', kinds: ['Array'] },
      { text: 'round(title.upper().', kinds: ['String'] },
      { text: 'if(true, title.', kinds: ['String'] },
      { text: 'missing(title.', kinds: ['String'] },
      { text: 'unknown.join(title.', kinds: ['String'] },
      { text: '-title.', kinds: ['String'] },
      { text: '(title.length() > 1 ? lines : title).', kinds: ['Array', 'String'] },
    ])('should offer only the methods of the type of the value before the dot: $text', ({ text, kinds }) => {
      const completions = language.complete(text, text.length, { fields: orderFields });

      expect(completions?.items.map(({ kind, label }) => [kind, label])).toEqual(methodsOf(kinds));
    });

    it('should find the value before the dot with the caret inside the formula', () => {
      const completions = language.complete('title. ? lines : 0', 6, { fields: orderFields });

      expect(completions?.items.map(({ kind, label }) => [kind, label])).toEqual(methodsOf(['String']));
    });

    it.each([
      { text: 'order.', kinds: ['Object'] },
      { text: 'lines.filter(current.', kinds: ['Object'] },
      { text: 'lines.first().', kinds: ['Object', 'Null'] },
    ])('should offer the fields of a record by their labels before its methods: $text', ({ text, kinds }) => {
      const completions = language.complete(text, text.length, { fields: orderFields });

      expect(completions?.items.map(({ kind, label, text }) => [kind, label, text])).toEqual([
        ['field', 'Quantity', 'qty'],
        ['field', 'sku', 'sku'],
        ...methodsOf(kinds).map(([kind, label]) => [kind, label, label]),
      ]);
    });

    it.each([
      { text: 'let a = 1, b = ', offset: 15, expected: ['a'] },
      { text: 'let a = 1, b = a in ', offset: 20, expected: ['a', 'b'] },
      { text: 'let a = 1 in let b = 2 in ', offset: 26, expected: ['b', 'a'] },
      { text: 'let a = ', offset: 8, expected: [] },
      { text: '(let a = 1 in a) + ', offset: 19, expected: [] },
      { text: 'list.filter(cur', offset: 15, expected: ['current', 'index'] },
      { text: 'list.filter(round(cur', offset: 21, expected: ['current', 'index'] },
      { text: 'list.map(x) + ', offset: 14, expected: [] },
      { text: 'list.join(', offset: 10, expected: [] },
    ])('should offer the variables the formula declares around the caret: $text at $offset', ({ text, offset, expected }) => {
      const variables = language.complete(text, offset)?.items.filter(({ kind }) => kind === 'variable').map(({ label }) => label);

      expect(variables).toEqual(expected);
    });

    it.each([
      { text: 'dateBetween(start, end, "da', offset: 27, from: 25, to: 27 },
      { text: 'dateBetween(start, end, "da")', offset: 26, from: 25, to: 27 },
      { text: 'dateBetween(start, end, "', offset: 25, from: 25, to: 25 },
    ])('should offer the words the argument takes in any signature inside its quotes: $text at $offset', ({ text, offset, from, to }) => {
      const completions = language.complete(text, offset);

      expect(completions && [completions.from, completions.to]).toEqual([from, to]);
      expect(completions?.items.map(({ kind, label, text }) => [kind, label, text])).toEqual(
        ['years', 'months', 'weeks', 'days', 'hours', 'minutes'].map((unit) => ['choice', unit, unit]),
      );
    });

    it('should offer the words of a repeated argument in each of its repeats', () => {
      expect(language.complete('unitsProbe(1, "days", "', 23)?.items.map(({ label }) => label)).toEqual(['days', 'hours']);
    });

    it.each([
      { text: 'price ', offset: 6 },
      { text: 'round(1, 25', offset: 10 },
      { text: 'text.match(/ab/', offset: 13 },
      { text: 'upper("ab', offset: 8 },
      { text: 'dateBetween("', offset: 13 },
      { text: 'a + @', offset: 5 },
    ])('should give nothing where no name or word can be typed: $text at $offset', ({ text, offset }) => {
      expect(language.complete(text, offset, { fields: [{ name: 'price' }] })).toBeUndefined();
    });
  });

  describe('diagnose', () => {
    const CHECKED_CODES: readonly string[] = ['REFERENCE_ERROR', 'ARGUMENT_TYPE_MISMATCH', 'ARGUMENT_COUNT_MISMATCH'];
    const records = fc.record({ a: formulaValueArbitrary(), b: formulaValueArbitrary(), c: formulaValueArbitrary() });

    it.prop([fieldFormulaArbitrary({ lazy: false }), records], { numRuns: 1000 })('should find an error only in a formula evaluation fails on, when evaluation reads all of it', (formula, record) => {
      const diagnostics = language.diagnose(formula, { fields: fieldsOf(record) });

      expect(diagnostics.length === 0 || 'error' in evaluateOutcome(formula, { context: record })).toBe(true);
    });

    // An operator inside an argument may fail first, where a wrong argument would fail later
    it.prop([fieldFormulaArbitrary({ lazy: true }), records], { numRuns: 1000 })('should give the error evaluation fails with on a name or a call, where it fails', (formula, record) => {
      const outcome = evaluateOutcome(formula, { context: record });
      const failure = 'error' in outcome && CHECKED_CODES.includes(outcome.error.code) ? outcome.error : undefined;
      const there = language.diagnose(formula, { fields: fieldsOf(record) }).filter(({ location }) => failure?.location && sameOffsets(location, failure.location));

      expect(there.map(({ code, messageKey }) => [code, messageKey])).toEqual(there.map(() => [failure?.code, failure?.messageKey]));
    });

    it('should give the code, payload, message and key of the error evaluation fails with', () => {
      expect(language.diagnose('title.round()', { fields: orderFields })).toEqual([{
        code: 'REFERENCE_ERROR',
        payload: { referenceType: 'method', name: 'round', target: 'Text' },
        message: 'Method "round" is not defined.',
        messageKey: 'formula_error.method_not_defined',
        location: { start: { offset: 6, line: 1, column: 7 }, end: { offset: 11, line: 1, column: 12 } },
      }]);
    });

    it('should give an operator error the formula it fails in, as evaluation does', () => {
      expect(language.diagnose('1 + -title', { fields: orderFields }).map(({ payload }) => payload)).toEqual([
        { reason: 'Cannot apply unary minus to non-numeric value', expression: '1 + -title' },
      ]);
    });

    it.each([
      { formula: 'title + totl', expected: [['formula_error.variable_not_defined', 'totl']] },
      { formula: 'nope(totl)', expected: [['formula_error.function_not_defined', 'nope(totl)']] },
      { formula: 'title.upper().nope(totl)', expected: [['formula_error.method_not_defined', 'nope']] },
      { formula: 'order.qtty()', expected: [['formula_error.field_not_defined', 'qtty']] },
      { formula: 'order.qty(1)', expected: [['formula_error.exact_argument_count', 'qty']] },
      { formula: 'round(title)', expected: [['formula_error.argument_type_mismatch', 'title']] },
      { formula: 'round(1, 2, 3)', expected: [['formula_error.too_many_arguments', 'round(1, 2, 3)']] },
      { formula: 'dateBetween(today(), today(), "dais")', expected: [['formula_error.argument_validation_error', '"dais"']] },
      { formula: 'round(totl, title)', expected: [['formula_error.variable_not_defined', 'totl']] },
      { formula: 'title * 2', expected: [['formula_error.non_numeric_math_operation', 'title * 2']] },
      { formula: '-title', expected: [['formula_error.unary_minus_non_numeric', '-title']] },
      { formula: 'title < 1', expected: [['formula_error.comparison_type_mismatch', 'title < 1']] },
      { formula: 'today() < now()', expected: [['formula_error.date_with_date_time', 'today() < now()']] },
      { formula: '1 in order.qty()', expected: [['formula_error.argument_type_mismatch', 'order.qty()']] },
      { formula: 'order in title', expected: [['formula_error.argument_type_mismatch', 'order']] },
      { formula: 'upper(title * 2)', expected: [['formula_error.non_numeric_math_operation', 'title * 2']] },
      { formula: 'lines.filter(curent > 1, 2)', expected: [['formula_error.exact_argument_count', 'filter']] },
      { formula: 'format(totl + "x", 1)', expected: [['formula_error.exact_argument_count', 'format(totl + "x", 1)'], ['formula_error.variable_not_defined', 'totl']] },
    ])('should find what evaluation fails on in every record of the field types: $formula', ({ formula, expected }) => {
      expect(language.diagnose(formula, { fields: orderFields }).map(({ messageKey, location }) => [messageKey, formula.slice(location.start.offset, location.end.offset)])).toEqual(expected);
    });

    it.each([
      { formula: 'true ? 1 : title.round()', expected: [['formula_error.method_not_defined', 'round']] },
      { formula: 'if(lines.length() > 0, title.round(), 1)', expected: [['formula_error.method_not_defined', 'round']] },
      { formula: 'lines.filter(curent.qty() > 1)', expected: [['formula_error.variable_not_defined', 'curent']] },
      { formula: 'lines.map(current.qtty())', expected: [['formula_error.field_not_defined', 'qtty']] },
    ])('should find what evaluation fails on whenever it reaches a part it may skip: $formula', ({ formula, expected }) => {
      expect(language.diagnose(formula, { fields: orderFields }).map(({ messageKey, location }) => [messageKey, formula.slice(location.start.offset, location.end.offset)])).toEqual(expected);
    });

    it('should name every type of a value that has no such method', () => {
      const [diagnostic] = language.diagnose('entry.nope()', { fields: [{ name: 'entry', type: { kind: 'Union', of: [{ kind: 'Number' }, { kind: 'String' }] } }] });

      expect(diagnostic?.payload).toEqual({ referenceType: 'method', name: 'nope', target: 'Number or Text' });
    });

    it.each([
      { formula: 'entry.round()', reason: 'a method only some types of the value have' },
      { formula: 'round(1, entry)', reason: 'an argument only some types of the value fit' },
      { formula: 'round(lines.first().sku(), 1)', reason: 'an argument of any type' },
      { formula: 'dateBetween(today(), today(), title)', reason: 'a word read from a field' },
      { formula: '(lines.length() > 0 ? null : 1).round()', reason: 'a method of a value that may be empty' },
      { formula: '(lines.length() > 0 ? null : title).round()', reason: 'a method neither type of the value has, one of them empty' },
      { formula: 'toDateTime(today(), title, 1)', reason: 'an argument checked after a word read from a field' },
      { formula: 'round(lines.length() > 0 ? "a" : "b")', reason: 'an argument whose value comes from a part of it' },
      { formula: 'lines.first().sku().filter(current > 1)', reason: 'an expression per item of a value of any type' },
      { formula: 'entry * 2', reason: 'an operand only some types of the value fit' },
      { formula: 'title + 1', reason: 'text joined with a number' },
      { formula: '1 / lines.length()', reason: 'a division by a number that may be zero' },
      { formula: 'parent(anything)', reason: 'a name read in the enclosing object' },
    ])('should find nothing where the error depends on the values: $reason', ({ formula }) => {
      expect(language.diagnose(formula, { fields: [...orderFields, { name: 'entry', type: { kind: 'Union', of: [{ kind: 'Number' }, { kind: 'String' }] } }] })).toEqual([]);
    });

    it('should check names only against the fields the host passes', () => {
      expect([language.diagnose('totl + 1'), language.diagnose('totl + 1', { fields: [] }).map(({ messageKey }) => messageKey)]).toEqual([[], ['formula_error.variable_not_defined']]);
    });

    it('should give only the syntax errors of a formula that has them', () => {
      expect(language.diagnose('title.round() + (', { fields: orderFields }).map(({ code }) => code)).toEqual(['EXPECTED_EXPRESSION', 'MISSING_TOKEN']);
    });
  });
});

/** The fields of a record, each with the type of its value. */
function fieldsOf(record: Readonly<Record<string, FormulaDataType>>): FormulaField[] {
  return Object.entries(record).map(([name, value]) => ({ name, type: typeOfValue(value) }));
}

function sameOffsets(left: FormulaLocation, right: FormulaLocation): boolean {
  return left.start.offset === right.start.offset && left.end.offset === right.end.offset;
}

/** The completion items of the methods called on values of `kinds`, in the order of the scope. */
function methodsOf(kinds: readonly string[]): string[][] {
  return routines.filter((routine) => routine.form === 'method' && routine.kinds.some((kind) => kinds.includes(kind))).map(({ name }) => ['method', name]);
}

function callPieces({ name, form, args }: { name: string; form: CallAtCaret['form']; args: readonly (readonly Piece[])[] }): Piece[] {
  const inArgument = (argument: number) => ({ name, form, argument });
  const argumentPieces = args.flatMap((pieces, index) => [
    ...(index === 0 ? [] : [{ text: ', ', call: inArgument(index) }]),
    ...pieces.map((piece) => ({ text: piece.text, call: piece.call ?? inArgument(index) })),
  ]);

  return [{ text: '(', call: inArgument(0) }, ...argumentPieces, { text: ')', call: undefined }];
}

function callsAtEachPiece({ pieces, text }: { pieces: readonly Piece[]; text: (end: number) => string }): (CallAtCaret | undefined)[] {
  let end = 0;

  return pieces.map((piece) => {
    end += piece.text.length;

    const help = language.signatureHelp(text(end), end);
    const routine = help?.routines[0];

    return help && routine && { name: routine.name, form: routine.form, argument: help.argument };
  });
}
