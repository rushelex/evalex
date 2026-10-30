import type { FormulaDataType } from '../data-types';
import type { FormulaType } from '../types';

import { fc, it } from '@fast-check/vitest';

import { evaluateOutcome, formulaValueArbitrary, matchesType, typeOfValue } from '../../testing-library';
import { ALL_DATA_TYPES, Kind } from '../data-types';
import { inferType } from '../infer-type';
import { parseFormula } from '../parse-formula';
import { routinesRegistry } from '../routines/registry';
import { routineCallArbitrary } from '../routines/test-helpers/routine-call-arbitrary';

// Routines that read the clock are deterministic only while it stands still.
vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(Temporal.ZonedDateTime.from('2025-08-02T10:30:00+00:00[UTC]'));

const NUMBER = { kind: 'Number' } as const;
const STRING = { kind: 'String' } as const;
const NULL = { kind: 'Null' } as const;
const ANY = { kind: 'Any' } as const;

const functionCalls = [...routinesRegistry.getFunctions()].map(([name, routine]) => ({
  label: name,
  call: routineCallArbitrary({ signatures: routine.signatures }).map((call) => call.asFunction(name)),
}));

const methodCalls = routinesRegistry.getRegisteredDataTypes().flatMap((ctor) => {
  const kind = ALL_DATA_TYPES.find((dataType) => dataType === ctor)?.kind ?? Kind.Any;

  return [...routinesRegistry.getMethods(ctor)].map(([name, routine]) => ({
    label: `${ctor.name}.${name}`,
    call: routineCallArbitrary({ signatures: routine.signatures, subjectKind: kind }).map((call) => call.asMethod(name)),
  }));
});

describe(inferType, () => {
  // The evaluator is the oracle: whatever a formula evaluates to on data of the field types, its type describes
  describe.each([...functionCalls, ...methodCalls])('$label', ({ call }) => {
    it.prop([call])('should give a type that describes what the call returns, whatever its arguments', ({ formula, context }) => {
      const outcome = evaluateOutcome(formula, { context });

      if ('value' in outcome) {
        expect(matchesType(outcome.value, typeOf(formula, context))).toBe(true);
      }
    });
  });

  it.prop([formulaArbitrary(), fc.record({ a: formulaValueArbitrary(), b: formulaValueArbitrary(), c: formulaValueArbitrary() })], { numRuns: 2000 })(
    'should give a type that describes what any formula returns on its fields',
    (formula, context) => {
      const outcome = evaluateOutcome(formula, { context });

      if ('value' in outcome) {
        expect(matchesType(outcome.value, typeOf(formula, context))).toBe(true);
      }
    },
  );

  it.each([
    { formula: '1 + 2 * 3', expected: NUMBER },
    { formula: '"total: " + 1', expected: STRING },
    { formula: '-x', expected: NUMBER },
    { formula: 'x == 1 and not y', expected: { kind: 'Boolean' } },
    { formula: '[1, "a", 2]', expected: { kind: 'Array', items: { kind: 'Union', of: [NUMBER, STRING] } } },
    { formula: 'true ? 1 : "a"', expected: { kind: 'Union', of: [NUMBER, STRING] } },
    { formula: 'let x = "a", y = [x] in y', expected: { kind: 'Array', items: STRING } },
    { formula: 'let s = "a" in s.upper()', expected: STRING },
    { formula: '/a+/i', expected: { kind: 'RegExp' } },
  ])('should give $formula the type its operators and literals give', ({ formula, expected }) => {
    expect(typeOf(formula)).toEqual(expected);
  });

  it('should give a name the type of its field, and any type to a name without one', () => {
    const fields = new Map<string, FormulaType>([['price', NUMBER], ['label', STRING]]);

    expect(inferType({ formula: parseFormula('label + price'), fields })).toEqual(STRING);
    expect(inferType({ formula: parseFormula('missing'), fields })).toEqual(ANY);
  });

  it('should give a name declared with let its value type over the field of the same name', () => {
    const fields = new Map<string, FormulaType>([['price', NUMBER]]);

    expect(inferType({ formula: parseFormula('let price = "free" in price'), fields })).toEqual(STRING);
  });

  it('should add numbers or join text by what each side may be', () => {
    const fields = new Map<string, FormulaType>([
      ['amount', { kind: 'Union', of: [NUMBER, STRING] }],
      ['anything', ANY],
    ]);

    expect(inferType({ formula: parseFormula('amount + 1'), fields })).toEqual({ kind: 'Union', of: [NUMBER, STRING] });
    expect(inferType({ formula: parseFormula('anything + 1'), fields })).toEqual({ kind: 'Union', of: [STRING, NUMBER] });
  });

  it.each([
    { formula: 'items.first()', expected: { kind: 'Union', of: [NUMBER, NULL] } },
    { formula: 'first(items)', expected: { kind: 'Union', of: [NUMBER, NULL] } },
    { formula: 'items.filter(current > 1)', expected: { kind: 'Array', items: NUMBER } },
    { formula: 'items.map(current.format())', expected: { kind: 'Array', items: STRING } },
    { formula: 'items.map(index)', expected: { kind: 'Array', items: NUMBER } },
    { formula: 'items.map(current * index).sum()', expected: NUMBER },
    { formula: 'items.concat(["a"])', expected: { kind: 'Array', items: { kind: 'Union', of: [NUMBER, STRING] } } },
  ])('should give $formula the type its routine returns for the items of a list of numbers', ({ formula, expected }) => {
    const fields = new Map<string, FormulaType>([['items', { kind: 'Array', items: NUMBER }]]);

    expect(inferType({ formula: parseFormula(formula), fields })).toEqual(expected);
  });

  it('should give a list of any items to a routine joining a list of any items', () => {
    const fields = new Map<string, FormulaType>([['anything', ANY]]);

    expect(inferType({ formula: parseFormula('concat(anything, [1])'), fields })).toEqual({ kind: 'Array', items: ANY });
  });

  it.each([
    { formula: 'order.qty()', expected: NUMBER },
    { formula: 'lines.map(current.qty())', expected: { kind: 'Array', items: NUMBER } },
    { formula: 'order.note()', expected: ANY },
  ])('should give a field read of a record the type of the field, or any type when it has none: $formula', ({ formula, expected }) => {
    const line = { kind: 'Object', fields: [{ name: 'qty', type: NUMBER }, { name: 'note' }] } as const;
    const fields = new Map<string, FormulaType>([['order', line], ['lines', { kind: 'Array', items: line }]]);

    expect(inferType({ formula: parseFormula(formula), fields })).toEqual(expected);
  });

  it('should leave out a record whose field read fails, as the call fails on it', () => {
    const fields = new Map<string, FormulaType>([
      ['entry', { kind: 'Union', of: [{ kind: 'Object', fields: [{ name: 'qty', type: NUMBER }] }, { kind: 'Object', fields: [] }] }],
    ]);

    expect(inferType({ formula: parseFormula('entry.qty()'), fields })).toEqual(NUMBER);
    expect(inferType({ formula: parseFormula('entry.qty(1)'), fields })).toEqual(ANY);
  });

  it('should leave out the types a method is not defined on, as the call fails on them', () => {
    const fields = new Map<string, FormulaType>([['price', { kind: 'Union', of: [NUMBER, NULL] }]]);

    expect(inferType({ formula: parseFormula('price.round()'), fields })).toEqual(NUMBER);
  });

  it('should give a result of each signature the arguments fit', () => {
    const fields = new Map<string, FormulaType>([
      ['day', { kind: 'Date' }],
      ['start', { kind: 'Union', of: [{ kind: 'Date' }, { kind: 'DateTime' }] }],
    ]);

    expect(inferType({ formula: parseFormula('dateAdd(day, 1, "days")'), fields })).toEqual({ kind: 'Date' });
    expect(inferType({ formula: parseFormula('dateAdd(start, 1, "days")'), fields })).toEqual({ kind: 'Union', of: [{ kind: 'Date' }, { kind: 'DateTime' }] });
  });

  it.each([
    { formula: 'order.total()', reason: 'a field of an object' },
    { formula: 'record.round()', reason: 'a call on a value that may be an object holding a field by the name of the method' },
    { formula: 'missing(1)', reason: 'a call of no routine' },
    { formula: 'if(true, 1, 2)', reason: 'a routine that reads its arguments itself' },
    { formula: 'value.round()', reason: 'a method of a value of any type' },
    { formula: 'maybe.round()', reason: 'a method of a value of a union with any type' },
    { formula: 'round(1, 2, 3)', reason: 'a call with arguments no signature takes' },
    { formula: '(1.5).round(1, 2, 3)', reason: 'a method call with arguments no signature takes' },
  ])('should give any type to $reason: $formula', ({ formula }) => {
    const fields = new Map<string, FormulaType>([
      ['order', { kind: 'Object' }],
      ['record', { kind: 'Union', of: [{ kind: 'Object' }, NUMBER] }],
      // A union the host writes need not fold any type into its members
      ['maybe', { kind: 'Union', of: [ANY, NUMBER] }],
    ]);

    expect(inferType({ formula: parseFormula(formula), fields })).toEqual(ANY);
  });
});

// Helpers

function typeOf(formula: string, context: Readonly<Record<string, FormulaDataType>> = {}): FormulaType {
  const fields = new Map(Object.entries(context).map(([name, value]) => [name, typeOfValue(value)]));

  return inferType({ formula: parseFormula(formula), fields });
}

const METHODS = ['first', 'last', 'at(0)', 'map(current)', 'filter(current)', 'sort()', 'concat([1])', 'sum()', 'length()', 'upper()', 'round()', 'format()', 'add(1)', 'reverse()', 'unique()', 'join(", ")', 'toNumber()', 'find(current)'];
const FUNCTIONS = ['first', 'max', 'sum', 'concat', 'abs', 'empty', 'if', 'length', 'map'];

/** Formulas over the fields `a`, `b` and `c`, of operators, literals, lists, `let` and calls of routines, with `current` and `index`. */
function formulaArbitrary(): fc.Arbitrary<string> {
  return fc.letrec<{ formula: string }>((tie) => ({
    formula: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      fc.constantFrom('1', '0', '-2.5', '"x"', '""', 'true', 'false', 'null', 'a', 'b', 'c', 'current', 'index', '[]'),
      fc.tuple(fc.constantFrom('-', '!'), tie('formula')).map(([operator, operand]) => `${operator}(${operand})`),
      fc.tuple(tie('formula'), fc.constantFrom('+', '-', '*', '/', '%', '==', '<', 'and', 'in'), tie('formula')).map(([left, operator, right]) => `(${left}) ${operator} (${right})`),
      fc.tuple(tie('formula'), tie('formula'), tie('formula')).map(([test, consequent, alternate]) => `(${test}) ? (${consequent}) : (${alternate})`),
      fc.array(tie('formula'), { maxLength: 3 }).map((items) => `[${items.join(', ')}]`),
      fc.tuple(tie('formula'), tie('formula')).map(([value, body]) => {
        // The body reads the variable where a formula outside reads `a`. A `let` holds more `let`s than any of
        // those nested in it, so their count names it apart from them, and their values never read it.
        const name = `v${body.match(/\blet\b/g)?.length ?? 0}`;

        return `let ${name} = (${value}) in (${body.replaceAll(/\ba\b/g, name)})`;
      }),
      fc.tuple(tie('formula'), fc.constantFrom(...METHODS)).map(([subject, method]) => `(${subject}).${method.includes('(') ? method : `${method}()`}`),
      fc.tuple(fc.constantFrom(...FUNCTIONS), fc.array(tie('formula'), { maxLength: 3 })).map(([name, args]) => `${name}(${args.join(', ')})`),
    ),
  })).formula;
}
