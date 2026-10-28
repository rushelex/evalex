/** The time zone formulas read dates in when the host names none. */
export const DEFAULT_TIME_ZONE = 'UTC';

/** Tells whether `name` is a time zone name such as `Europe/Berlin` or an offset such as `+05:00`. */
export function isTimeZone(name: string): boolean {
  try {
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(name);
    return true;
  }
  catch {
    return false;
  }
}
