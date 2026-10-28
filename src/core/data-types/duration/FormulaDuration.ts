import type { ToStringOptions } from '../FormulaDataType';

import { Temporal } from 'temporal-polyfill';

import { formatWith } from '../../value-format';
import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

/** A duration a formula computes: `value` holds it as a `Temporal.Duration`. */
export class FormulaDuration extends FormulaDataType<Temporal.Duration, typeof Kind.Duration> {
  static readonly kind = Kind.Duration;

  constructor(value: Temporal.Duration) {
    super(Kind.Duration, value, 'Duration');
  }

  isEmpty(): boolean {
    return false;
  }

  toString(options?: ToStringOptions): string {
    return formatWith({ formatter: options?.format?.duration, value: this.value, kind: 'duration' }) ?? this.value.toString();
  }

  static from(value: Temporal.Duration): FormulaDuration {
    return new FormulaDuration(value);
  }

  static isValidInput(value: unknown): value is Temporal.Duration {
    return value instanceof Temporal.Duration;
  }
}
