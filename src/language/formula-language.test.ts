import { fc, it } from '@fast-check/vitest';

import { FormulaScope } from '../core/formula-scope';
import { FormulaLanguage } from './index';

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
});

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
