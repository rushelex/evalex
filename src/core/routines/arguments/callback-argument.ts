import type { FormulaDataType, Kind } from '../../data-types';
import type { FormulaType } from '../../types';

import { kindsOf, type } from '../../types';
import { argumentName } from './argument-name';

interface CallbackArgumentOptions {
  readonly optional?: boolean;
  readonly returns?: FormulaType;
  /** The types of the variables, by name; a variable left out holds any value. */
  readonly variableTypes?: Readonly<Partial<Record<string, FormulaType>>>;
}

/**
 * Definition of an argument evaluated by the routine itself, once per call, with extra variables in scope.
 *
 * @remarks
 * `TVariables` and `TReturn` exist only for types: they type `execute` of the {@link CallbackExecutor}
 * the handler receives. The kinds of `returns` are enforced at run time.
 */
export class CallbackArgument<TVariables extends string = string, TReturn extends FormulaDataType = FormulaDataType> {
  /** The name signature help and error messages show. */
  readonly name: string;
  readonly optional: boolean;
  readonly contextVariables: readonly TVariables[];
  /** What each evaluation returns, as the catalog shows it. */
  readonly returns: FormulaType;
  /** The kinds each evaluation is checked against, see {@link kindsOf}. */
  readonly returnKinds: readonly Kind[];
  /** The types of {@link CallbackArgument.contextVariables}, by name; a variable left out holds any value. */
  readonly variableTypes: Readonly<Partial<Record<string, FormulaType>>>;
  declare readonly returnValueType?: TReturn;

  /** @throws Error when the name is blank. */
  constructor(
    contextVariables: readonly TVariables[],
    name: string,
    options?: CallbackArgumentOptions,
  ) {
    this.name = argumentName(name);
    this.optional = options?.optional ?? false;
    this.contextVariables = contextVariables;
    this.returns = options?.returns ?? type.any;
    this.returnKinds = kindsOf(this.returns);
    this.variableTypes = options?.variableTypes ?? {};
  }
}
