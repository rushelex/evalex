import type { FormulaDataType, FormulaDataTypeByKind, Kind } from '../../data-types';

/** What a failed custom check reports; the position of the argument is filled in by the engine. */
export interface ArgumentValidationFailure {
  readonly message: string;
  readonly expected?: readonly unknown[];
  readonly actual?: unknown;
}

type ArgumentValidation<TValue extends FormulaDataType> = (dataType: TValue) => ArgumentValidationFailure | undefined;

export interface ArgumentOptions<TValue extends FormulaDataType> {
  readonly name?: string;
  readonly optional?: boolean;
  readonly repeatable?: boolean;
  readonly validation?: ArgumentValidation<TValue>;
}

/**
 * Definition of one value argument of a routine signature.
 *
 * @remarks
 * `TValue`, `TOptional` and `TRepeatable` exist only for types: they let a routine handler receive
 * its arguments typed from the signature. The constructor does not check them against the options.
 */
export class Argument<
  TKind extends Kind = Kind,
  TValue extends FormulaDataType = FormulaDataTypeByKind<TKind>,
  TOptional extends boolean = boolean,
  TRepeatable extends boolean = boolean,
> {
  readonly types: TKind | TKind[];
  readonly name?: string;
  readonly optional: TOptional;
  readonly repeatable: TRepeatable;
  readonly validation?: ArgumentValidation<FormulaDataType>;
  declare readonly valueType?: TValue;

  constructor(
    types: TKind | TKind[],
    options?: ArgumentOptions<FormulaDataTypeByKind<TKind>>,
  ) {
    this.types = types;
    this.name = options?.name;
    this.optional = (options?.optional ?? false) as TOptional;
    this.repeatable = (options?.repeatable ?? false) as TRepeatable;
    // Validation runs only after the type check has passed, so the value always has the declared type.
    this.validation = options?.validation as ArgumentValidation<FormulaDataType> | undefined;
  }
}
