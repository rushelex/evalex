/**
 * System limits for the formula runtime.
 * These limits are designed to prevent performance issues and stack overflows
 * while still allowing for complex real-world use cases.
 */
export const FORMULA_LIMITS = {
  /**
   * Maximum depth of formula dependency chains to prevent stack overflow.
   * Example: A -> B -> C -> ... -> Z would have depth 26
   */
  MAX_FORMULA_DEPTH: 50,

  /**
   * Maximum number of direct dependencies a single formula can have.
   * Example: "a + b + c + ... + z" would have 26 dependencies
   */
  MAX_DEPENDENCIES_PER_FORMULA: 100,

  /**
   * Maximum number of formulas that can be registered in a single system.
   * This limit prevents memory issues in large applications.
   */
  MAX_FORMULAS_COUNT: 10_000,
} as const;
