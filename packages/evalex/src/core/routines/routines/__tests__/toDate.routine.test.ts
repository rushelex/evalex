import { fc, it } from '@fast-check/vitest';

import { evaluate } from '../../../../testing-library';
import { FormulaBoolean, FormulaDate, FormulaDateTime, FormulaString } from '../../../data-types';
import { FormulaScope } from '../../../formula-scope';

const zoneArbitrary = fc.constantFrom('UTC', 'Europe/Moscow', 'America/New_York', 'Pacific/Chatham', '+05:45', '-09:30');

// Away from the ends of the supported dates, where the start of the day before falls outside them
const dateTimeArbitrary = fc.date({ min: new Date('1900-01-01T00:00Z'), max: new Date('2200-01-01T00:00Z'), noInvalidDate: true })
  .map((date) => FormulaDateTime.from(date));

describe('toDate routine', () => {
  it.prop([dateTimeArbitrary, zoneArbitrary])('should give the day whose start is not after the date and time, in the zone given', (at, timeZone) => {
    expect(evaluate('toDateTime(toDate(at, zone), "00:00", zone) <= at', { context: { at, zone: new FormulaString(timeZone) } }))
      .toBeFormulaDataType(FormulaBoolean, true);
  });

  it.prop([dateTimeArbitrary, zoneArbitrary])('should read the day in the zone of the scope when the call gives none', (at, timeZone) => {
    const scope = new FormulaScope({ timeZone });

    expect(scope.evaluate('toDate(at)', { at }).value).toEqual(scope.evaluate(`toDate(at, "${timeZone}")`, { at }).value);
  });

  it('should give the day in Moscow of an evening in UTC as the next day', () => {
    expect(new FormulaScope({ timeZone: 'Europe/Moscow' }).evaluate('parseDate("2026-10-07T22:30Z").toDate()'))
      .toBeFormulaDataType(FormulaDate, Temporal.PlainDate.from('2026-10-08'));
  });

  it('should not take a date without a time', () => {
    expect(() => evaluate('toDate(parseDate("2026-10-07"))')).toThrow('Expected type DateTime. [7,30]');
  });
});
