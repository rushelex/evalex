import type { ValueFormat } from '../value-format';
import type { Kind } from './kind';

export interface ToStringOptions {
  asJSON?: boolean;
  /** The host's formatters; values of a kind without one keep their own text. */
  format?: ValueFormat;
}

/**
 * The shape every value a formula computes shares: its `kind`, its JavaScript `value` and its text.
 *
 * @remarks
 * A host never creates one: it passes plain values and gets these back as results, of the kinds `FormulaValue` lists.
 */
export abstract class FormulaDataType<TValue = unknown, TKind extends Kind = Kind> {
  /** The data type, a literal per class, so a union of data types narrows by it. */
  readonly kind: TKind;
  /** The JavaScript form of the value, such as a `number` or a `Temporal.ZonedDateTime`. */
  readonly value: TValue;
  /** The name of the data type to show to a person, such as `Date range`. */
  readonly displayType: string;

  protected constructor(
    kind: TKind,
    value: TValue,
    displayType: string,
  ) {
    this.kind = kind;
    this.value = value;
    this.displayType = displayType;
  }

  /** Returns whether a condition reads the value as false: `0`, `""`, `false`, an empty list or object, and `null`. */
  abstract isEmpty(): boolean;

  /** Returns the text a formula gives the value, such as with `format()`, through the host's formatters when given. */
  abstract toString(options?: ToStringOptions): string;
}
