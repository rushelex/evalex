import type { FormulaDataType, Kind } from '../../data-types';
import type { FormulaType, ValueType } from '../../types';
import type { ProcessedArgument } from './processed-argument';

import { kindsOf } from '../../types';
import { argumentName } from './argument-name';
import { RepresentativeArgument } from './representative-argument';

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
  TValue extends FormulaDataType = FormulaDataType,
  TOptional extends boolean = boolean,
  TRepeatable extends boolean = boolean,
> {
  /** The values the argument takes, as the catalog shows them. */
  readonly type: FormulaType;
  /** The kinds a call checks the value against, see {@link kindsOf}. */
  readonly kinds: readonly Kind[];
  /** The name signature help and error messages show. */
  readonly name: string;
  readonly optional: TOptional;
  readonly repeatable: TRepeatable;
  readonly validation?: ArgumentValidation<FormulaDataType>;
  readonly choices?: readonly string[];
  declare readonly valueType?: TValue;

  /**
   * @param type Built with `type`, it gives `validation` the class of the values; a plain one gives it any value.
   * @throws Error when the name is blank.
   */
  constructor(type: ValueType<TValue> | FormulaType, name: string, options?: ArgumentOptions<TValue>) {
    this.type = type;
    this.kinds = kindsOf(type);
    this.name = argumentName(name);
    this.optional = (options?.optional ?? false) as TOptional;
    this.repeatable = (options?.repeatable ?? false) as TRepeatable;
    // Validation runs only after the type check has passed, so the value always has the declared type.
    this.validation = options?.validation as ArgumentValidation<FormulaDataType> | undefined;
    this.choices = options?.choices;
  }

  /** What the argument's own check finds wrong with a value of a kind it takes; nothing on a {@link RepresentativeArgument}. */
  failureOn(value: ProcessedArgument): ArgumentValidationFailure | undefined {
    return value instanceof RepresentativeArgument ? undefined : this.validation?.(value.dataType);
  }
}
