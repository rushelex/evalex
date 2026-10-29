import type { FormulaDataType } from '../../data-types';

import { Kind } from '../../data-types';
import { argumentName } from './argument-name';

interface CallbackArgumentOptions {
  /** The name signature help and error messages show; must not be blank. */
  name: string;
  optional?: boolean;
  returnType?: Kind | Kind[];
}

/**
 * Definition of an argument evaluated by the routine itself, once per call, with extra variables in scope.
 *
 * @remarks
 * `TVariables` and `TReturn` exist only for types: they type `execute` of the {@link CallbackExecutor}
 * the handler receives. The return type is enforced at run time by `returnType`.
 */
export class CallbackArgument<TVariables extends string = string, TReturn extends FormulaDataType = FormulaDataType> {
  readonly types = Kind.Any;
  readonly name: string;
  readonly optional: boolean;
  readonly contextVariables: readonly TVariables[];
  readonly returnType: Kind | Kind[];
  declare readonly returnValueType?: TReturn;

  /** @throws Error when the name is blank. */
  constructor(
    contextVariables: readonly TVariables[],
    options: CallbackArgumentOptions,
  ) {
    this.name = argumentName(options.name);
    this.optional = options.optional ?? false;
    this.contextVariables = contextVariables;
    this.returnType = options.returnType ?? Kind.Any;
  }
}
