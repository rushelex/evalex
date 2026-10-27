import type { FormulaDataType } from './data-types';

/** Values a formula reads by name at the top level, looked up only by the names the formula reads. */
export interface GlobalProperties extends Pick<ReadonlyMap<string, FormulaDataType>, 'get' | 'has'> {
  /** Names of the object enclosing the record these names start at, for `parent`; none where nothing encloses it. */
  readonly enclosing?: () => GlobalProperties;
  /** Names of the record next to this one in its list, for `previous` and `next`; `undefined` where there is none. */
  readonly neighbor?: (offset: -1 | 1) => GlobalProperties | undefined;
}

/**
 * Formula evaluation context.
 */
export class FormulaEvaluationContext {
  // Properties available at the top level
  #globalProperties: GlobalProperties;
  // Parent context for nested scopes
  #parentContext: FormulaEvaluationContext | null;
  // Local scope for variables
  #localScope: Map<string, FormulaDataType>;

  /**
   * Creates an instance of BaseFormulaContext.
   * @param globalProperties Map of global properties (e.g., task fields).
   * @param parentContext Optional parent context for nested scopes.
   * @param initialLocalScope Optional map to initialize the local scope.
   */
  constructor(
    globalProperties: GlobalProperties = new Map(),
    parentContext: FormulaEvaluationContext | null = null,
    initialLocalScope: Map<string, FormulaDataType> = new Map(),
  ) {
    this.#globalProperties = globalProperties;
    this.#parentContext = parentContext;
    this.#localScope = initialLocalScope;
  }

  /**
   * Checks if a variable with the given name exists in the current or any parent scope.
   */
  hasVariable(name: string): boolean {
    return this.isLocalVariable(name) || this.#globalProperties.has(name);
  }

  /**
   * Retrieves a variable by its name from the current or any parent scope.
   */
  getVariable(name: string): FormulaDataType | undefined {
    // Local scopes from the innermost out, so a formula's own names hide the host's properties
    const localScope = this.#localScopeWith(name);

    // The innermost global properties, which `parent`, `previous` and `next` replace for their expression
    return localScope ? localScope.get(name) : this.#globalProperties.get(name);
  }

  #localScopeWith(name: string): ReadonlyMap<string, FormulaDataType> | undefined {
    if (this.#localScope.has(name)) {
      return this.#localScope;
    }

    return this.#parentContext ? this.#parentContext.#localScopeWith(name) : undefined;
  }

  /** The global properties names fall back to once no local scope has them. */
  get globalProperties(): GlobalProperties {
    return this.#globalProperties;
  }

  /** A nested context whose names, beyond the local scopes around it, come from other global properties. */
  withGlobalProperties(globalProperties: GlobalProperties): FormulaEvaluationContext {
    return new FormulaEvaluationContext(globalProperties, this, new Map());
  }

  /**
   * Checks whether `getVariable` would resolve the name from a local scope rather than from global properties.
   */
  isLocalVariable(name: string): boolean {
    if (this.#localScope.has(name)) {
      return true;
    }

    return this.#parentContext?.isLocalVariable(name) ?? false;
  }

  /**
   * Adds or updates a variable in the current local scope.
   * @param name Variable name.
   * @param value Variable value (must be FormulaDataType).
   */
  setVariable(name: string, value: FormulaDataType): void {
    this.#localScope.set(name, value);
  }

  /**
   * To create nested scopes (e.g. for "current" and "index" in array's map method)
   */
  createNestedContext(newScopeValues: Record<string, FormulaDataType>): FormulaEvaluationContext {
    const newLocalScope = new Map<string, FormulaDataType>();

    for (const key in newScopeValues) {
      if (Object.hasOwn(newScopeValues, key)) {
        newLocalScope.set(key, newScopeValues[key]);
      }
    }

    // Global properties are passed by reference from the topmost context
    // or each context has its own copy if needed (current implementation passes a reference)
    return new FormulaEvaluationContext(this.#globalProperties, this, newLocalScope);
  }
}
