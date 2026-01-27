import type { InferFormulaDataTypeByKind, Kind } from '../../data-types';

interface ArgumentOptions<T extends Kind> {
  name?: string;
  optional?: boolean;
  repeatable?: boolean;
  validation?: (dataType: InferFormulaDataTypeByKind<T>) => string | undefined;
}

export class Argument<T extends Kind = Kind> {
  public readonly types: T | readonly T[];
  public readonly name?: string;
  public readonly optional: boolean;
  public readonly repeatable: boolean;
  public readonly validation?: (dataType: InferFormulaDataTypeByKind<T>) => string | undefined;

  constructor(
    types: T | readonly T[],
    options?: ArgumentOptions<T>,
  ) {
    this.types = types;
    this.name = options?.name;
    this.optional = options?.optional ?? false;
    this.repeatable = options?.repeatable ?? false;
    this.validation = options?.validation;
  }
}
