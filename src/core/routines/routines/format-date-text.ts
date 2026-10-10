import type { Temporal } from 'temporal-polyfill';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

// Indexed by `dayOfWeek % 7`, so Sunday comes first
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// Indexed by the last digit of the day; the other digits take "th"
const ORDINAL_SUFFIXES: readonly string[] = ['th', 'st', 'nd', 'rd'];

type TokenFormatter = (date: Temporal.ZonedDateTime) => string;

const TOKENS: Readonly<Record<string, TokenFormatter>> = {
  YYYY: (date) => signed(date.year, 4),
  YY: (date) => pad(Math.abs(date.year) % 100, 2),
  Y: (date) => String(date.year),
  Q: (date) => String(Math.ceil(date.month / 3)),
  MMMM: (date) => monthName(date),
  MMM: (date) => monthName(date).slice(0, 3),
  MM: (date) => pad(date.month, 2),
  M: (date) => String(date.month),
  DD: (date) => pad(date.day, 2),
  Do: (date) => ordinal(date.day),
  D: (date) => String(date.day),
  dddd: (date) => weekdayName(date),
  ddd: (date) => weekdayName(date).slice(0, 3),
  dd: (date) => weekdayName(date).slice(0, 2),
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
  A: (date) => (date.hour < 12 ? 'AM' : 'PM'),
  a: (date) => (date.hour < 12 ? 'am' : 'pm'),
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

interface FormatDateTextOptions {
  /** The date in the time zone whose fields the text shows. */
  readonly date: Temporal.ZonedDateTime;
  readonly pattern: string;
}

/**
 * Builds the text of a date from a pattern of tokens such as `YYYY`, `MMMM` or `h`, with English names.
 *
 * @remarks
 * The text is built from the date fields by hand rather than through `Intl`, so it never depends on the host locale
 * or on the engine's locale data. Letters that are not tokens are kept, and text in brackets is kept as is.
 */
export function formatDateText({ date, pattern }: FormatDateTextOptions): string {
  return pattern.replaceAll(TOKEN_PATTERN, (token: string, literal: string | undefined) => literal ?? TOKENS[token](date));
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

function signed(value: number, length: number): string {
  return value < 0 ? `-${pad(-value, length)}` : pad(value, length);
}

function monthName(date: Temporal.ZonedDateTime): string {
  return MONTHS[date.month - 1];
}

function weekdayName(date: Temporal.ZonedDateTime): string {
  return WEEKDAYS[date.dayOfWeek % 7];
}

function twelveHour(date: Temporal.ZonedDateTime): number {
  return date.hour % 12 || 12;
}

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }

  return `${day}${ORDINAL_SUFFIXES[day % 10] ?? 'th'}`;
}
