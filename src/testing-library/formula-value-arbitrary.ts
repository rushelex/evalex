import type { FormulaDataType } from '../core';

import { fc } from '@fast-check/vitest';

import {
  FormulaArray,
  FormulaBoolean,
  FormulaDate,
  FormulaDateRange,
  FormulaDuration,
  FormulaNull,
  FormulaNumber,
  FormulaObject,
  FormulaRegExp,
  FormulaString,
  Kind,
} from '../core';

// `fc.letrec` types `tie` only for a type with an index signature.
interface FormulaValueArbitraries extends Record<string, FormulaDataType> {
  readonly value: FormulaDataType;
  readonly list: FormulaArray;
  readonly object: FormulaObject;
}

// The range of instants a date can hold.
const MAX_EPOCH_MILLISECONDS = 8_640_000_000_000_000n;

// Calendar units of a duration are capped by Temporal at 2^32 - 1; time units by the total of 2^53 seconds.
const MAX_CALENDAR_UNITS = 2 ** 32 - 1;

// Real patterns next to escaped text, plus one invalid pattern a host can still construct.
const PATTERNS = ['', '.', '\\d+', '[a-z]*', '^a|b$', '(x)(y)?', '\\p{L}+', '('];

// Numbers where arithmetic, rounding and conversions to dates and text tend to break.
const EDGE_NUMBERS = [
  -0,
  0.5,
  -0.5,
  1e-7,
  1e21,
  2 ** 32,
  Number.MAX_SAFE_INTEGER,
  -Number.MAX_SAFE_INTEGER,
  Number.MAX_VALUE,
  Number.MIN_VALUE,
  8_640_000_000_000_001,
];

const number = fc.oneof(fc.double({ noNaN: true, noDefaultInfinity: true }), fc.integer(), fc.constantFrom(...EDGE_NUMBERS)).map((value) => new FormulaNumber(value));

const text = fc.oneof(fc.string(), fc.string({ unit: 'grapheme' }), fc.string({ unit: 'binary' })).map((value) => new FormulaString(value));

const boolean = fc.boolean().map((value) => new FormulaBoolean(value));

const nullValue = fc.constant(null).map(() => new FormulaNull());

const date = fc.bigInt({ min: -MAX_EPOCH_MILLISECONDS, max: MAX_EPOCH_MILLISECONDS }).map((milliseconds) => {
  return FormulaDate.from(Temporal.Instant.fromEpochMilliseconds(Number(milliseconds)).toZonedDateTimeISO('UTC'));
});

const dateRange = fc.tuple(date, date).map(([first, second]) => {
  const [start, end] = Temporal.ZonedDateTime.compare(first.value, second.value) <= 0 ? [first, second] : [second, first];

  return new FormulaDateRange({ start: start.value, end: end.value });
});

const duration = fc.tuple(
  fc.constantFrom(1, -1),
  fc.nat({ max: MAX_CALENDAR_UNITS }),
  fc.nat({ max: MAX_CALENDAR_UNITS }),
  fc.nat({ max: MAX_CALENDAR_UNITS }),
  fc.nat({ max: 100_000_000 }),
  fc.nat({ max: 1_000_000_000 }),
  fc.nat({ max: 1_000_000_000 }),
  fc.nat({ max: 1_000_000_000 }),
  fc.nat({ max: 1_000_000_000 }),
).map(([sign, ...units]) => new FormulaDuration(new Temporal.Duration(...units.map((unit) => sign * unit))));

const regexp = fc.tuple(
  fc.oneof(fc.constantFrom(...PATTERNS), fc.string().map(escapePattern)),
  fc.subarray(['d', 'g', 'i', 'm', 's', 'u', 'y']),
).map(([pattern, flags]) => new FormulaRegExp(pattern, flags.join('')));

const arbitraries = fc.letrec<FormulaValueArbitraries>((tie) => ({
  value: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    number,
    text,
    boolean,
    nullValue,
    date,
    dateRange,
    duration,
    regexp,
    tie('list'),
    tie('object'),
  ),
  list: fc.array(tie('value'), { maxLength: 4 }).map((items) => new FormulaArray(items)),
  object: fc.dictionary(fc.string(), tie('value'), { maxKeys: 4 }).map((entries) => new FormulaObject(entries)),
}));

const BY_KIND: Readonly<Record<Kind, fc.Arbitrary<FormulaDataType>>> = {
  [Kind.Any]: arbitraries.value,
  [Kind.Array]: arbitraries.list,
  [Kind.Boolean]: boolean,
  [Kind.Date]: date,
  [Kind.DateRange]: dateRange,
  [Kind.Duration]: duration,
  [Kind.Null]: nullValue,
  [Kind.Number]: number,
  [Kind.Object]: arbitraries.object,
  [Kind.RegExp]: regexp,
  [Kind.String]: text,
};

/**
 * Generates values a host can pass into a formula, including the edges of each type such as the largest number, lone
 * surrogates, the first and last representable instant and an invalid regular expression.
 *
 * @param kind - the data type to generate; values of every type, with nested lists and objects, when omitted
 */
export function formulaValueArbitrary(kind: Kind = Kind.Any): fc.Arbitrary<FormulaDataType> {
  return BY_KIND[kind];
}

// Helpers

function escapePattern(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
}
