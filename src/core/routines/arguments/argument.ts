import type { InferFormulaDataTypeByKind, Kind } from '../../data-types';

interface ArgumentOptions<T extends Kind> {
  name?: string;
  optional?: boolean;
  repeatable?: boolean;
  validation?: (dataType: InferFormulaDataTypeByKind<T>) => string | undefined;
}

export class Argument<T extends Kind = Kind> {
  readonly types: T | T[];
  readonly name?: string;
  readonly optional: boolean;
  readonly repeatable: boolean;
  readonly validation?: (dataType: InferFormulaDataTypeByKind<T>) => string | undefined;

  constructor(
    types: T | T[],
    options?: ArgumentOptions<T>,
  ) {
    this.types = types;
    this.name = options?.name;
    this.optional = options?.optional ?? false;
    this.repeatable = options?.repeatable ?? false;
    this.validation = options?.validation;
  }
}
