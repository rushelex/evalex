import type { DateNames } from '../../value-format';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

// Indexed by `dayOfWeek % 7`, so Sunday comes first
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// Indexed by the last digit of the day; the other digits take "th"
const ORDINAL_SUFFIXES: readonly string[] = ['th', 'st', 'nd', 'rd'];

const ENGLISH: Required<DateNames> = {
  months: MONTHS,
  monthsStandalone: MONTHS,
  monthsShort: MONTHS.map((name) => name.slice(0, 3)),
  weekdays: WEEKDAYS,
  weekdaysShort: WEEKDAYS.map((name) => name.slice(0, 3)),
  weekdaysMin: WEEKDAYS.map((name) => name.slice(0, 2)),
  dayPeriods: ['AM', 'PM'],
  ordinal,
};

type TokenFormatter = (date: Temporal.ZonedDateTime, names: Required<DateNames>) => string;

const TOKENS: Readonly<Record<string, TokenFormatter>> = {
  YYYY: (date) => signed(date.year, 4),
  YY: (date) => pad(Math.abs(date.year) % 100, 2),
  Y: (date) => String(date.year),
  Q: (date) => String(Math.ceil(date.month / 3)),
  MMMM: (date, names) => names.months[date.month - 1],
  MMM: (date, names) => names.monthsShort[date.month - 1],
  MM: (date) => pad(date.month, 2),
  M: (date) => String(date.month),
  LLLL: (date, names) => names.monthsStandalone[date.month - 1],
  DD: (date) => pad(date.day, 2),
  Do: (date, names) => names.ordinal(date.day),
  D: (date) => String(date.day),
  dddd: (date, names) => names.weekdays[date.dayOfWeek % 7],
  ddd: (date, names) => names.weekdaysShort[date.dayOfWeek % 7],
  dd: (date, names) => names.weekdaysMin[date.dayOfWeek % 7],
  d: (date) => String(date.dayOfWeek % 7),
  HH: (date) => pad(date.hour, 2),
  H: (date) => String(date.hour),
  hh: (date) => pad(twelveHour(date), 2),
  h: (date) => String(twelveHour(date)),
  mm: (date) => pad(date.minute, 2),
  m: (date) => String(date.minute),
  ss: (date) => pad(date.second, 2),
  s: (date) => String(date.second),
  SSS: (date) => pad(date.millisecond, 3),
  A: (date, names) => dayPeriod(date, names),
  a: (date, names) => dayPeriod(date, names).toLowerCase(),
  ZZ: (date) => date.offset.replace(':', ''),
  Z: (date) => date.offset,
  X: (date) => String(Math.floor(date.epochMilliseconds / 1000)),
  x: (date) => String(date.epochMilliseconds),
};

// Text in brackets is kept as is; longer tokens come first, so `MMMM` is never read as four `M`
const TOKEN_PATTERN = new RegExp(
  String.raw`\[([^\]]*)]|${Object.keys(TOKENS).toSorted((left, right) => right.length - left.length).join('|')}`,
  'g',
);

// Tokens that show a time, a time zone or an instant, which a date without a time does not have
const TIME_TOKENS: ReadonlySet<string> = new Set(['HH', 'H', 'hh', 'h', 'mm', 'm', 'ss', 's', 'SSS', 'A', 'a', 'ZZ', 'Z', 'X', 'x']);

interface FormatDateTextOptions {
  /** A date without a time, or a date and time in the time zone whose fields the text shows. */
  readonly date: Temporal.PlainDate | Temporal.ZonedDateTime;
  readonly pattern: string;
  /** The host's words; a token whose words are left out uses English. */
  readonly names?: DateNames;
}

/**
 * Builds the text of a date from a pattern of tokens such as `YYYY`, `MMMM` or `h`, with the host's words or English.
 *
 * @remarks
 * The text is built from the date fields by hand rather than through `Intl`, so it never depends on the host locale
 * or on the engine's locale data. Letters that are not tokens are kept, and text in brackets is kept as is.
 */
export function formatDateText({ date, pattern, names = {} }: FormatDateTextOptions): string {
  const words: Required<DateNames> = {
    months: names.months ?? ENGLISH.months,
    // A language without a separate standalone form gives only `months`
    monthsStandalone: names.monthsStandalone ?? names.months ?? ENGLISH.monthsStandalone,
    monthsShort: names.monthsShort ?? ENGLISH.monthsShort,
    weekdays: names.weekdays ?? ENGLISH.weekdays,
    weekdaysShort: names.weekdaysShort ?? ENGLISH.weekdaysShort,
    weekdaysMin: names.weekdaysMin ?? ENGLISH.weekdaysMin,
    dayPeriods: names.dayPeriods ?? ENGLISH.dayPeriods,
    ordinal: names.ordinal ?? ENGLISH.ordinal,
  };

  // Only the date tokens read a date without a time, so any time of day serves; its patterns are checked by `timeTokensIn`.
  const fields = date instanceof Temporal.PlainDate ? date.toZonedDateTime('UTC') : date;

  return pattern.replaceAll(TOKEN_PATTERN, (token: string, literal: string | undefined) => literal ?? TOKENS[token](fields, words));
}

/** The tokens of a pattern that show a time, a time zone or an instant, outside text in brackets. */
export function timeTokensIn(pattern: string): string[] {
  return Array.from(pattern.matchAll(TOKEN_PATTERN), ([token, literal]) => (literal === undefined && TIME_TOKENS.has(token) ? token : undefined))
    .filter((token) => token !== undefined);
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

function signed(value: number, length: number): string {
  return value < 0 ? `-${pad(-value, length)}` : pad(value, length);
}

function twelveHour(date: Temporal.ZonedDateTime): number {
  return date.hour % 12 || 12;
}

function dayPeriod(date: Temporal.ZonedDateTime, names: Required<DateNames>): string {
  return names.dayPeriods[date.hour < 12 ? 0 : 1];
}

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }

  return `${day}${ORDINAL_SUFFIXES[day % 10] ?? 'th'}`;
}
