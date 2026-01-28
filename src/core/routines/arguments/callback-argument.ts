import type { Kind } from '../../data-types';

interface CallbackArgumentOptions {
  name?: string;
  optional?: boolean;
  returnType?: Kind | readonly Kind[];
}

export class CallbackArgument {
  readonly types = 'any';
  readonly name?: string;
  readonly optional: boolean;
  readonly contextVariables: string[];
  readonly returnType: Kind | readonly Kind[];

  constructor(
    contextVariables: string[],
    options?: CallbackArgumentOptions,
  ) {
    this.name = options?.name;
    this.optional = options?.optional ?? false;
    this.contextVariables = contextVariables;
    this.returnType = options?.returnType ?? 'any';
  }
}
