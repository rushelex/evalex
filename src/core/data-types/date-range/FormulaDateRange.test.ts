import { fc, it } from '@fast-check/vitest';

import { FormulaDateTime } from '../date-time';
import { FormulaDateRange } from './FormulaDateRange';

// Every instant a date can hold, as Unix milliseconds
const instant = fc.integer({ min: -8_640_000_000_000_000, max: 8_640_000_000_000_000 });

const orderedDates = fc.tuple(instant, instant)
  .map((milliseconds) => milliseconds.toSorted((a, b) => a - b).map((value) => FormulaDateTime.from(value).value));

describe(FormulaDateRange, () => {
  it.prop([orderedDates])('should keep both ends of a range whose end is not before its start', ([start, end]) => {
    const range = FormulaDateRange.from({ start, end });

    expect([range.value.start.epochMilliseconds, range.value.end.epochMilliseconds]).toEqual([start.epochMilliseconds, end.epochMilliseconds]);
  });

  it.prop([orderedDates.filter(([start, end]) => !start.equals(end))])('should reject an end before the start', ([start, end]) => {
    expect(() => FormulaDateRange.from({ start: end, end: start })).toThrow(RangeError);
  });

  it('should allow a range that starts and ends at the same moment', () => {
    expect(FormulaDateRange.from({ start: '2024-07-28T12:00Z', end: '2024-07-28T15:00+03:00' }).toString()).toBe('2024-07-28T12:00:00Z → 2024-07-28T12:00:00Z');
  });

  it('should hold both ends in UTC', () => {
    const range = FormulaDateRange.from({ start: '2024-07-28T15:00+03:00', end: '2024-07-29T15:00+03:00[Europe/Moscow]' });

    expect([range.value.start.timeZoneId, range.value.end.timeZoneId]).toEqual(['UTC', 'UTC']);
  });

  it('should write both ends as ISO 8601 instants joined by an arrow', () => {
    expect(FormulaDateRange.from({ start: '2022-09-07', end: '2023-09-07T12:30Z' }).toString()).toBe('2022-09-07T00:00:00Z → 2023-09-07T12:30:00Z');
  });

  it('should reject an end that holds no date', () => {
    expect(() => FormulaDateRange.from({ start: '2022-09-07', end: 'soon' })).toThrow('Cannot create a date from the text "soon".');
  });
});
