/** Powers of ten from 10^0 to 10^22, the ones a double holds exactly. */
export const POWERS_OF_TEN: readonly number[] = Array.from({ length: 23 }, (_, power) => 10 ** power);
