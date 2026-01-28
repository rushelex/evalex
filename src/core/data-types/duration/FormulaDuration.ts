import { Temporal } from 'temporal-polyfill';

import { FormulaDataType } from '../FormulaDataType';

export class FormulaDuration extends FormulaDataType<Temporal.Duration> {
  static readonly kind = 'duration';

  constructor(value: Temporal.Duration) {
    super('duration', value, 'Duration');
  }

  isEmpty(): boolean {
    return false;
  }

  toString(): string {
    return this.value.toString();
  }

  static from(value: Temporal.Duration): FormulaDuration {
    return new FormulaDuration(value);
  }

  static isValidInput(value: unknown): value is Temporal.Duration {
    return value instanceof Temporal.Duration;
  }
}
