import type { Kind } from './kind';

export interface ToStringOptions {
  asJSON?: boolean;
}

/**
 * Abstract base class for all data types used in the formula system.
 * Each concrete data type (string, number, list, etc.) must inherit from this class.
 */
export abstract class FormulaDataType<TValue = any> {
  /**
   * Constructor for the base formula data type.
   * @param kind The kind of the data type.
   * @param value The value that this type encapsulates.
   * @param displayType The display type for the user interface.
   */
  protected constructor(
    public readonly kind: Kind,
    public readonly value: TValue,
    public readonly displayType: string,
  ) {}

  /**
   * Checks if the value is considered empty.
   * This is used for functions like empty() and for conditional logic.
   */
  public abstract isEmpty(): boolean;

  /**
   * Returns a string representation of the value.
   * This is used for display and debugging purposes.
   */
  public abstract toString(options?: ToStringOptions): string;
}
