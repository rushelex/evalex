import type { FormulaErrorPayloads } from '../../error-payloads';

import { createErrorDefinition } from '../../create-error-definition';
import { FormulaErrorCode } from '../../error-codes';

/**
 * Error thrown when a variable is not defined in the context.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator when variable is not found
 * const context = { a: 5, b: 10 };
 * evaluate('a + c', context) // throws VariableNotDefined for 'c'
 *
 * // Valid usage
 * evaluate('a + b', context) // OK - returns 15
 *
 * // Manual creation
 * throw VariableNotDefined.create({ name: 'undefinedVar' }, { location: node.location });
 *
 * // Type checking
 * if (VariableNotDefined.is(error)) {
 *   console.log(error.payload.name); // 'undefinedVar'
 *   console.log(error.payload.referenceType); // 'variable'
 * }
 * ```
 *
 * @param name - The name of the undefined variable
 */
export const VariableNotDefined = createErrorDefinition({
  code: FormulaErrorCode.REFERENCE_ERROR,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.REFERENCE_ERROR], 'referenceType' | 'target'>) => ({
    referenceType: 'variable',
    ...payload,
  }),
  formatMessage: ({ name }) => `Variable "${name}" is not defined.`,
  messageKey: 'formula_error.variable_not_defined',
});

/**
 * Error thrown when a function is not defined in the registry.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator when function is not found
 * evaluate('unknownFunc(5)') // throws FunctionNotDefined for 'unknownFunc'
 * evaluate('customFn(1, 2)') // throws FunctionNotDefined if not registered
 *
 * // Valid usage
 * evaluate('sum(1, 2, 3)') // OK - sum is registered
 * evaluate('if(true, 1, 2)') // OK - if is registered
 *
 * // Manual creation
 * throw FunctionNotDefined.create({ name: 'customFunction' }, { location: node.location });
 *
 * // Type checking
 * if (FunctionNotDefined.is(error)) {
 *   console.log(error.payload.name); // 'customFunction'
 *   console.log(error.payload.referenceType); // 'function'
 * }
 * ```
 *
 * @param name - The name of the undefined function
 */
export const FunctionNotDefined = createErrorDefinition({
  code: FormulaErrorCode.REFERENCE_ERROR,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.REFERENCE_ERROR], 'referenceType' | 'target'>) => ({
    referenceType: 'function',
    ...payload,
  }),
  formatMessage: ({ name }) => `Function "${name}" is not defined.`,
  messageKey: 'formula_error.function_not_defined',
});

/**
 * Error thrown when a method is not defined on a data type.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator when method is not found
 * evaluate('"hello".unknownMethod()') // throws MethodNotDefined
 * evaluate('[1, 2, 3].invalidOp()') // throws MethodNotDefined
 *
 * // Valid usage
 * evaluate('"hello".toUpper()') // OK - toUpper is defined for strings
 * evaluate('[1, 2, 3].length()') // OK - length is defined for arrays
 *
 * // Manual creation
 * throw MethodNotDefined.create({ name: 'unknownMethod', target: 'String' }, { location: node.location });
 *
 * // Type checking
 * if (MethodNotDefined.is(error)) {
 *   console.log(error.payload.name); // 'unknownMethod'
 *   console.log(error.payload.target); // 'String'
 *   console.log(error.payload.referenceType); // 'method'
 * }
 * ```
 *
 * @param name - The name of the undefined method
 * @param target - Optional target type or object name
 */
export const MethodNotDefined = createErrorDefinition({
  code: FormulaErrorCode.REFERENCE_ERROR,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.REFERENCE_ERROR], 'referenceType'>) => ({
    referenceType: 'method',
    ...payload,
  }),
  formatMessage: ({ name }) => `Method "${name}" is not defined.`,
  messageKey: 'formula_error.method_not_defined',
});

/**
 * Error thrown when a formula reads a method or field the empty value does not have.
 *
 * @remarks
 * Points at the empty value rather than at the name read from it: the value is what the user has to fix, such as
 * a link the host left empty.
 *
 * @example
 * ```typescript
 * evaluate('project.rate()', { project: null }) // throws EmptyValueRead at `project`
 * evaluate('null.empty()') // OK - empty values have `empty()`
 * ```
 */
export const EmptyValueRead = createErrorDefinition({
  code: FormulaErrorCode.REFERENCE_ERROR,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.REFERENCE_ERROR], 'referenceType'>) => ({
    referenceType: 'method',
    ...payload,
  }),
  formatMessage: ({ name }) => `Cannot read "${name}" of an empty value.`,
  messageKey: 'formula_error.empty_value_read',
});

/**
 * Error thrown when a field is not defined on an object.
 *
 * @example
 * ```typescript
 * // Thrown automatically by evaluator when field is not found
 * const context = { user: { name: 'John', age: 30 } };
 * evaluate('user.email', context) // throws FieldNotDefined for 'email'
 * evaluate('user.address.city', context) // throws FieldNotDefined for 'address'
 *
 * // Valid usage
 * evaluate('user.name', context) // OK - returns 'John'
 * evaluate('user.age', context) // OK - returns 30
 *
 * // Manual creation
 * throw FieldNotDefined.create({ name: 'email', target: 'user' }, { location: node.location });
 *
 * // Type checking
 * if (FieldNotDefined.is(error)) {
 *   console.log(error.payload.name); // 'email'
 *   console.log(error.payload.target); // 'user'
 *   console.log(error.payload.referenceType); // 'field'
 * }
 * ```
 *
 * @param name - The name of the undefined field
 * @param target - Optional target object name
 */
export const FieldNotDefined = createErrorDefinition({
  code: FormulaErrorCode.REFERENCE_ERROR,
  createPayload: (payload: Omit<FormulaErrorPayloads[typeof FormulaErrorCode.REFERENCE_ERROR], 'referenceType'>) => ({
    referenceType: 'field',
    ...payload,
  }),
  formatMessage: ({ name }) => `Field "${name}" is not defined.`,
  messageKey: 'formula_error.field_not_defined',
});
