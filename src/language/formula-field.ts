/** A field of the host a formula reads by name, as completion offers it. */
export interface FormulaField {
  /** The name the formula reads it by, such as `price`. */
  readonly name: string;
  /**
   * The name the author knows it by, such as `Price`: completion shows it and finds the field by it.
   *
   * @default name
   */
  readonly label?: string;
}
