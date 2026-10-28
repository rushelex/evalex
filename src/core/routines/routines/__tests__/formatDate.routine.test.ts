import { fc, it } from '@fast-check/vitest';

import { evaluate } from '../../../../testing-library';
import { FormulaDateTime, FormulaNumber, FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

const tester = new RoutineTester('formatDate');

const date = fc.integer({ min: Date.UTC(1, 0, 1), max: Date.UTC(9999, 11, 31) }).map((milliseconds) => FormulaDateTime.from(milliseconds));

const timezone = fc.constantFrom('UTC', 'Europe/Berlin', 'Asia/Kolkata', 'America/St_Johns', 'Pacific/Kiritimati', '-03:30');

const TOKENS = ['YYYY', 'YY', 'Y', 'Q', 'MMMM', 'MMM', 'MM', 'M', 'LLLL', 'DD', 'Do', 'D', 'dddd', 'ddd', 'dd', 'd', 'HH', 'H', 'hh', 'h', 'mm', 'm', 'ss', 's', 'SSS', 'A', 'a', 'ZZ', 'Z', 'X', 'x'] as const;

// Every character here is kept as is: none of them is a token or a bracket
const plainText = fc.string({ unit: fc.constantFrom(...'0123456789 -/:.,_!?bcefgijklnoprtuvwzBCEFGIJKNOPRTUVW') });

describe('formatDate routine', () => {
  it.prop([date, plainText])('should keep a pattern without tokens as it is', (value, pattern) => {
    expect(evaluate('formatDate(date, pattern)', { context: { date: value, pattern: new FormulaString(pattern) } })).toBeFormulaDataType(FormulaString, pattern);
  });

  it.prop([date, fc.string().filter((text) => !text.includes(']'))])('should keep text in brackets as it is', (value, text) => {
    expect(evaluate('formatDate(date, pattern)', { context: { date: value, pattern: new FormulaString(`[${text}]`) } })).toBeFormulaDataType(FormulaString, text);
  });

  it.prop([date, timezone])('should give text that reads back as the same moment in any time zone', (value, zone) => {
    const formula = 'timestamp(parseDate(formatDate(date, "YYYY-MM-DDTHH:mm:ss.SSSZ", zone)))';

    expect(evaluate(formula, { context: { date: value, zone: new FormulaString(zone) } })).toBeFormulaDataType(FormulaNumber, value.value.epochMilliseconds);
  });

  it.prop([date, fc.array(fc.constantFrom(...TOKENS, ' ', '/')).map((parts) => parts.join('')), timezone])('should give the same text through format', (value, pattern, zone) => {
    const context = { date: value, pattern: new FormulaString(pattern), zone: new FormulaString(zone) };

    expect(evaluate('format(date, pattern, zone)', { context })).toBeFormulaDataType(FormulaString, evaluate('formatDate(date, pattern, zone)', { context }).value);
  });

  it.each([
    { day: '01', expected: '1st' },
    { day: '02', expected: '2nd' },
    { day: '03', expected: '3rd' },
    { day: '04', expected: '4th' },
    { day: '11', expected: '11th' },
    { day: '12', expected: '12th' },
    { day: '13', expected: '13th' },
    { day: '20', expected: '20th' },
    { day: '21', expected: '21st' },
    { day: '22', expected: '22nd' },
    { day: '23', expected: '23rd' },
    { day: '31', expected: '31st' },
  ])('should write day $day as the ordinal $expected', ({ day, expected }) => {
    expect(evaluate(`formatDate(parseDate("2023-08-${day}"), "Do")`)).toBeFormulaDataType(FormulaString, expected);
  });

  describe('on a machine far from UTC', () => {
    beforeAll(() => {
      vi.stubEnv('TZ', 'Pacific/Kiritimati');
    });

    afterAll(() => {
      vi.unstubAllEnvs();
    });

    it('should show the date in UTC when no time zone is given', () => {
      expect(evaluate('formatDate(parseDate("2023-08-30T23:30Z"), "YYYY-MM-DD HH:mm")')).toBeFormulaDataType(FormulaString, '2023-08-30 23:30');
    });
  });

  describe('examples', tester.examples([
    {
      formula: 'parseDate("2023-08-30T00:05Z").formatDate("h:mm A")',
      expected: new FormulaString('12:05 AM'),
    },
    {
      formula: 'parseDate("2023-08-30T11:59Z").formatDate("h:mm A")',
      expected: new FormulaString('11:59 AM'),
    },
    {
      formula: 'parseDate("2023-08-30T12:00Z").formatDate("hh:mm A a")',
      expected: new FormulaString('12:00 PM pm'),
    },
    {
      formula: 'parseDate("2023-08-30T13:07Z").formatDate("hh:mm a, H HH")',
      expected: new FormulaString('01:07 pm, 13 13'),
    },
    {
      formula: 'parseDate("2023-08-30T03:04:05.007Z").formatDate("H HH, m mm, s ss.SSS")',
      expected: new FormulaString('3 03, 4 04, 5 05.007'),
    },
    {
      formula: 'parseDate("2023-01-05").formatDate("MMMM MMM MM M, DD D")',
      expected: new FormulaString('January Jan 01 1, 05 5'),
    },
    {
      formula: 'parseDate("2023-12-31").formatDate("MMMM MMM MM M, Q")',
      expected: new FormulaString('December Dec 12 12, 4'),
    },
    {
      formula: 'parseDate("2023-03-31").formatDate("Q")',
      expected: new FormulaString('1'),
    },
    {
      formula: 'parseDate("2023-04-01").formatDate("Q")',
      expected: new FormulaString('2'),
    },
    {
      formula: 'parseDate("2023-09-03").formatDate("dddd ddd dd d")',
      expected: new FormulaString('Sunday Sun Su 0'),
    },
    {
      formula: 'parseDate("2023-09-02").formatDate("dddd ddd dd d")',
      expected: new FormulaString('Saturday Sat Sa 6'),
    },
    {
      formula: 'parseDate("2005-06-07").formatDate("YYYY YY Y")',
      expected: new FormulaString('2005 05 2005'),
    },
    {
      formula: 'parseDate("0033-06-07").formatDate("YYYY YY Y")',
      expected: new FormulaString('0033 33 33'),
    },
    {
      formula: 'parseDate("2023-08-30T14:05Z").formatDate("HH:mm Z ZZ", "Asia/Kolkata")',
      expected: new FormulaString('19:35 +05:30 +0530'),
    },
    {
      formula: 'parseDate("2023-08-30T14:05Z").formatDate("HH:mm Z", "-03:30")',
      expected: new FormulaString('10:35 -03:30'),
    },
    {
      formula: 'parseDate("1969-12-31T23:59:59.500Z").formatDate("X x")',
      expected: new FormulaString('-1 -500'),
    },
    {
      formula: 'parseDate("2023-08-30").formatDate("[Due] dddd")',
      expected: new FormulaString('Due Wednesday'),
    },
    {
      formula: 'parseDate("2023-08-30").formatDate("YYYY", "")',
      expected: {
        function: {
          message: 'Expected a time zone name such as "Europe/Berlin" or an offset such as "+05:00".',
          location: [44, 46],
        },
        method: {
          message: 'Expected a time zone name such as "Europe/Berlin" or an offset such as "+05:00".',
          location: [43, 45],
        },
      },
    },
  ]));
});
