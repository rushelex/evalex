import type { ValueFormat } from '../value-format';
import type { Kind } from './kind';

export interface ToStringOptions {
  asJSON?: boolean;
  /** The host's formatters; values of a kind without one keep their own text. */
  format?: ValueFormat;
}

/**
 * Abstract base class for all data types used in the formula system.
 * Each concrete data type (string, number, list, etc.) must inherit from this class.
 */
export abstract class FormulaDataType<TValue = unknown> {
  readonly kind: Kind;
  readonly value: TValue;
  readonly displayType: string;

  /**
   * Constructor for the base formula data type.
   * @param kind The kind of the data type.
   * @param value The value that this type encapsulates.
   * @param displayType The display type for the user interface.
   */
  protected constructor(
    kind: Kind,
    value: TValue,
    displayType: string,
  ) {
    this.kind = kind;
    this.value = value;
    this.displayType = displayType;
  }

  /**
   * Checks if the value is considered empty.
   * This is used for functions like empty() and for conditional logic.
   */
  abstract isEmpty(): boolean;

  /**
   * Returns a string representation of the value.
   * This is used for display and debugging purposes.
   */
  abstract toString(options?: ToStringOptions): string;
}
