import type { FormulaDataType, FormulaDataTypeByKind, Kind } from '../../data-types';

import { argumentName } from './argument-name';

/** What a failed custom check reports; the position of the argument is filled in by the engine. */
export interface ArgumentValidationFailure {
  readonly message: string;
  readonly expected?: readonly unknown[];
  readonly actual?: unknown;
}

type ArgumentValidation<TValue extends FormulaDataType> = (dataType: TValue) => ArgumentValidationFailure | undefined;

export interface ArgumentOptions<TValue extends FormulaDataType> {
  readonly optional?: boolean;
  readonly repeatable?: boolean;
  readonly validation?: ArgumentValidation<TValue>;
  /** The only words a text argument takes, as `arg.choice` lists them; `validation` enforces them. */
  readonly choices?: readonly string[];
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
  /** The name signature help and error messages show. */
  readonly name: string;
  readonly optional: TOptional;
  readonly repeatable: TRepeatable;
  readonly validation?: ArgumentValidation<FormulaDataType>;
  readonly choices?: readonly string[];
  declare readonly valueType?: TValue;

  /** @throws Error when the name is blank. */
  constructor(
    types: TKind | TKind[],
    name: string,
    options?: ArgumentOptions<FormulaDataTypeByKind<TKind>>,
  ) {
    this.types = types;
    this.name = argumentName(name);
    this.optional = (options?.optional ?? false) as TOptional;
    this.repeatable = (options?.repeatable ?? false) as TRepeatable;
    // Validation runs only after the type check has passed, so the value always has the declared type.
    this.validation = options?.validation as ArgumentValidation<FormulaDataType> | undefined;
    this.choices = options?.choices;
  }
}
