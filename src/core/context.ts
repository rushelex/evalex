import type { FormulaDataType } from './data-types';

/**
 * Formula evaluation context.
 */
export class FormulaEvaluationContext {
  // Properties available at the top level
  #globalProperties: Map<string, FormulaDataType>;
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
    globalProperties: Map<string, FormulaDataType> = new Map(),
    parentContext: FormulaEvaluationContext | null = null,
    initialLocalScope: Map<string, FormulaDataType> = new Map(),
  ) {
    this.#globalProperties = globalProperties;
    this.#parentContext = parentContext;
    this.#localScope = new Map(initialLocalScope); // Copy to avoid external mutations
  }

  /**
   * Checks if a variable with the given name exists in the current or any parent scope.
   */
  hasVariable(name: string): boolean {
    // First search in the local scope
    if (this.#localScope.has(name)) {
      return true;
    }

    // Then in the global properties of the current context
    if (this.#globalProperties.has(name)) {
      return true;
    }

    // If there is a parent context, delegate to it
    if (this.#parentContext) {
      return this.#parentContext.hasVariable(name);
    }

    return false;
  }

  /**
   * Retrieves a variable by its name from the current or any parent scope.
   */
  getVariable(name: string): FormulaDataType | undefined {
    // First search in the local scope (variables may override properties)
    if (this.#localScope.has(name)) {
      return this.#localScope.get(name);
    }

    // Then in the global properties of the current context
    if (this.#globalProperties.has(name)) {
      return this.#globalProperties.get(name);
    }

    // If there is a parent context, delegate to it
    if (this.#parentContext) {
      return this.#parentContext.getVariable(name);
    }

    return undefined;
  }

  /**
   * Checks whether `getVariable` would resolve the name from a local scope rather than from global properties.
   */
  isLocalVariable(name: string): boolean {
    if (this.#localScope.has(name)) {
      return true;
    }

    if (this.#globalProperties.has(name)) {
      return false;
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
