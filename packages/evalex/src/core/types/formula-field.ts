import type { FormulaType } from './formula-type';

/** A field of the host a formula reads by name, as completion offers it, or a field of a record a formula reads. */
export interface FormulaField {
  /** The name the formula reads it by, such as `price`. */
  readonly name: string;
  /**
   * The name the author knows it by, such as `Price`: completion shows it and finds the field by it.
   *
   * @default name
   */
  readonly label?: string;
  /**
   * The values the field holds, such as `{ kind: 'Array', items: { kind: 'Number' } }` for a list of numbers: completion
   * after a dot offers the methods of this type, and the fields of a record.
   *
   * @default { kind: 'Any' }
   */
  readonly type?: FormulaType;
}
