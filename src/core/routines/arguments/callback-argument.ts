import { Kind } from '../../data-types';

interface CallbackArgumentOptions {
  name?: string;
  optional?: boolean;
  returnType?: Kind | Kind[];
}

export class CallbackArgument {
  readonly types = Kind.Any;
  readonly name?: string;
  readonly optional: boolean;
  readonly contextVariables: string[];
  readonly returnType: Kind | Kind[];

  constructor(
    contextVariables: string[],
    options?: CallbackArgumentOptions,
  ) {
    this.name = options?.name;
    this.optional = options?.optional ?? false;
    this.contextVariables = contextVariables;
    this.returnType = options?.returnType ?? Kind.Any;
  }
}
