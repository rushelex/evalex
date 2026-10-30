import { fc } from '@fast-check/vitest';

const LEAVES = ['1', '0', '-2.5', '"x"', '""', 'true', 'false', 'null', 'a', 'b', 'c', 'current', 'index', '[]', 'missing'];

// Field reads and calls that fail: `qty` is a field only some records have
const METHODS = ['first()', 'last()', 'at(0)', 'sort()', 'concat([1])', 'sum()', 'length()', 'upper()', 'round()', 'round(1, 2, 3)', 'format()', 'add(1)', 'reverse()', 'unique()', 'join(", ")', 'toNumber()', 'contains(1)', 'qty()', 'nope()'];
const PER_ITEM_METHODS = ['map(current)', 'filter(current)', 'find(current)', 'map(current.upper())', 'filter(missing)'];

const FUNCTIONS = ['first', 'max', 'sum', 'concat', 'abs', 'empty', 'length', 'upper', 'round', 'nope'];
const LAZY_FUNCTIONS = ['if', 'map'];

const OPERATORS = ['+', '-', '*', '/', '%', '==', '<', 'in'];
const LAZY_OPERATORS = ['and', 'or'];

/**
 * Formulas over the fields `a`, `b` and `c`, of operators, literals, lists, `let` and calls of routines, with names,
 * routines and fields that may not exist.
 *
 * @param options - What the formulas may hold.
 * @param options.lazy -Whether a formula may hold parts evaluation may skip: branches of `? :` and `if`, the right side
 * of `and` and `or`, and expressions evaluated per item, where `current` and `index` are defined.
 */
export function fieldFormulaArbitrary({ lazy }: { readonly lazy: boolean }): fc.Arbitrary<string> {
  const methods = lazy ? [...METHODS, ...PER_ITEM_METHODS] : METHODS;
  const functions = lazy ? [...FUNCTIONS, ...LAZY_FUNCTIONS] : FUNCTIONS;
  const operators = lazy ? [...OPERATORS, ...LAZY_OPERATORS] : OPERATORS;

  return fc.letrec<{ formula: string }>((tie) => ({
    formula: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      fc.constantFrom(...LEAVES),
      fc.tuple(fc.constantFrom('-', '!'), tie('formula')).map(([operator, operand]) => `${operator}(${operand})`),
      fc.tuple(tie('formula'), fc.constantFrom(...operators), tie('formula')).map(([left, operator, right]) => `(${left}) ${operator} (${right})`),
      ...(lazy ? [fc.tuple(tie('formula'), tie('formula'), tie('formula')).map(([test, consequent, alternate]) => `(${test}) ? (${consequent}) : (${alternate})`)] : []),
      fc.array(tie('formula'), { maxLength: 3 }).map((items) => `[${items.join(', ')}]`),
      fc.tuple(tie('formula'), tie('formula')).map(([value, body]) => {
        // The body reads the variable where a formula outside reads `a`. A `let` holds more `let`s than any of
        // those nested in it, so their count names it apart from them, and their values never read it.
        const name = `v${body.match(/\blet\b/g)?.length ?? 0}`;

        return `let ${name} = (${value}) in (${body.replaceAll(/\ba\b/g, name)})`;
      }),
      fc.tuple(tie('formula'), fc.constantFrom(...methods)).map(([subject, method]) => `(${subject}).${method}`),
      fc.tuple(fc.constantFrom(...functions), fc.array(tie('formula'), { maxLength: 3 })).map(([name, args]) => `${name}(${args.join(', ')})`),
    ),
  })).formula;
}
