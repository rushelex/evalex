interface UnitDurationOptions {
  readonly unit: 'years' | 'quarters' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds';
  readonly amount: number;
}

/** Duration of a whole number of date units for `dateAdd` and `dateSubtract`; a quarter is three months, which Temporal has no unit for. */
export function unitDuration({ unit, amount }: UnitDurationOptions): Temporal.DurationLike {
  return unit === 'quarters' ? { months: amount * 3 } : { [unit]: amount };
}
