import { fc, it } from '@fast-check/vitest';

import { evaluate } from '../../../../testing-library';
import { FormulaDate, FormulaDateTime, FormulaString, Kind } from '../../../data-types';
import { FormulaScope } from '../../../formula-scope';

const zoneArbitrary = fc.constantFrom('UTC', 'Europe/Moscow', 'America/New_York', 'Pacific/Chatham', '+05:45', '-09:30');

// Away from the ends of the supported dates, where a time on the first or the last day falls outside them
const dateArbitrary = fc.date({ min: new Date('1900-01-01T00:00Z'), max: new Date('2200-01-01T00:00Z'), noInvalidDate: true })
  .map((date) => FormulaDate.from(date.toISOString().slice(0, 10)));

const utc = (instant: string): Temporal.ZonedDateTime => Temporal.Instant.from(instant).toZonedDateTimeISO('UTC');

describe('toDateTime routine', () => {
  it.prop([dateArbitrary, zoneArbitrary])('should give a date and time that falls on the same day in the zone given', (date, timeZone) => {
    expect(evaluate('toDate(toDateTime(date, "13:30", zone), zone)', { context: { date, zone: new FormulaString(timeZone) } }).value)
      .toEqual(date.value);
  });

  it.prop([dateArbitrary, zoneArbitrary])('should place the date in the zone of the scope when the call gives none', (date, timeZone) => {
    const scope = new FormulaScope({ timeZone });

    expect(scope.evaluate('toDateTime(date, "13:30")', { date }).value).toEqual(scope.evaluate(`toDateTime(date, "13:30", "${timeZone}")`, { date }).value);
  });

  it.prop([dateArbitrary, zoneArbitrary])('should give back the date and time in UTC', (date, timeZone) => {
    const result = new FormulaScope({ timeZone }).evaluate('toDateTime(date)', { date });

    expect(result.kind === Kind.DateTime && result.value.timeZoneId).toBe('UTC');
  });

  it('should start a day the clocks enter at one in the morning at one in the morning', () => {
    expect(new FormulaScope({ timeZone: 'America/Havana' }).evaluate('parseDate("2023-03-12").toDateTime()'))
      .toBeFormulaDataType(FormulaDateTime, utc('2023-03-12T05:00Z'));
  });

  it.each(['24:00', '13:60', '1:30', '13', 'T13:30', '2023-08-30T13:30', ''])('should reject "%s" as a time', (time) => {
    expect(() => evaluate(`toDateTime(parseDate("2023-08-30"), "${time}")`)).toThrow('Expected a time such as "13:30" or "09:05:30". [36,');
  });

  it('should take seconds and their fraction', () => {
    expect(evaluate('toDateTime(parseDate("2023-08-30"), "09:05:30.250")'))
      .toBeFormulaDataType(FormulaDateTime, utc('2023-08-30T09:05:30.250Z'));
  });

  it('should fail at the call for a time past the last instant a date and time holds', () => {
    expect(() => evaluate('toDateTime(day, "13:30")', { context: { day: FormulaDate.from('+275760-09-13') } }))
      .toThrow('Date is out of the supported range. [0,24]');
  });

  it('should not take a date and time', () => {
    expect(() => evaluate('toDateTime(parseDate("2026-10-07T10:00Z"))')).toThrow('Expected type Date. [11,41]');
  });
});
