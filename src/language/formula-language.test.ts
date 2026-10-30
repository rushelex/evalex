import { fc, it } from '@fast-check/vitest';

import { FormulaObject, FormulaString } from '../core/data-types';
import { FormulaScope } from '../core/formula-scope';
import { arg } from '../core/routines/arguments';
import { routinesRegistry } from '../core/routines/registry';
import { type } from '../core/types';
import { formulaValueArbitrary, typeOfValue } from '../testing-library';
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
});

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
