import { Temporal } from 'temporal-polyfill';

import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

export class FormulaDuration extends FormulaDataType<Temporal.Duration> {
  static readonly kind = Kind.Duration;

  constructor(value: Temporal.Duration) {
    super(Kind.Duration, value, 'Duration');
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
