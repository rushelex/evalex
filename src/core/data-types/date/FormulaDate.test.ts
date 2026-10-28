import { fc, it } from '@fast-check/vitest';

import { FormulaDate } from './FormulaDate';

// Every day a date without a time can hold
const day = fc.integer({ min: -100_000_000, max: 100_000_000 }).map((days) => Temporal.PlainDate.from('1970-01-01').add({ days }));

describe(FormulaDate, () => {
  it.prop([day])('should read back the day from its own text', (value) => {
    expect(FormulaDate.from(new FormulaDate(value).toString()).value.equals(value)).toBe(true);
  });

  it.each([
    { text: '2024-07', day: '2024-07-01' },
    { text: '2024', day: '2024-01-01' },
    { text: '20240728', day: '2024-07-28' },
  ])('should read "$text" as the first day it names', ({ text, day: first }) => {
    expect(FormulaDate.from(text).value.toString()).toBe(first);
  });

  it.each(['2024-07-28T10:00', '2024-07-28 10:00', '2024-07-28t10:00Z', 'soon', ''])('should reject "%s" as a date without a time', (text) => {
    expect(() => FormulaDate.from(text)).toThrow(new RangeError(`Cannot create a date without a time from the text "${text}".`));
    expect(FormulaDate.isDayText(text)).toBe(false);
  });

  it('should take its text from the date formatter', () => {
    expect(FormulaDate.from('2024-07-28').toString({ format: { date: (value) => `${value.day}/${value.month}` } })).toBe('28/7');
  });
});
