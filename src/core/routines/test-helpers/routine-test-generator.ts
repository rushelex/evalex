import type { FormulaDataType } from '../../data-types';
import type { RoutinesRegistry } from '../registry';
import type { RoutineTestExampleOptions } from '../routine-test-example';
import type { FormulaTypeResolver } from './formula-type-resolver';
import type { ExpectedResult } from './types';

import { RoutineTestExample } from '../routine-test-example';
import { isExpectedError } from './types';

export interface RoutineTestCase {
  group: 'function' | (string & {});
  name: string;
  functionCall?: string;
  methodCall?: string;
  context: Record<string, FormulaDataType>;
  expected: ExpectedResult;
}

export interface GenerateOptions {
  /**
   * Include built-in examples from routine definitions
   * @default true
   */
  includeBuiltIn?: boolean;
}

/**
 * Generates test cases for routine functions and methods
 * Supports both built-in examples from routine definitions and custom test examples
 */
export class RoutineTestGenerator {
  readonly #registry: RoutinesRegistry;
  readonly #typeResolver: FormulaTypeResolver;

  constructor(
    registry: RoutinesRegistry,
    typeResolver: FormulaTypeResolver,
  ) {
    this.#registry = registry;
    this.#typeResolver = typeResolver;
  }

  /**
   * Generates test cases for function testing.
   * Returns: functionExamples + customFunctionExamples (deduplicated by functionCall)
   */
  forFunctionTesting(
    routineName: string,
    examples: RoutineTestExampleOptions[],
    options?: GenerateOptions,
  ): RoutineTestCase[] {
    const { includeBuiltIn = true } = options ?? {};

    const builtInCases = includeBuiltIn ? this.generateFunctionExamples(routineName) : [];
    const customCases = this.generateFunctionCustomExamples(routineName, examples);

    return this.#filterUniqueBy([...builtInCases, ...customCases], 'functionCall');
  }

  /**
   * Generates test cases for method testing.
   * Returns: methodExamples + customMethodExamples (deduplicated by methodCall)
   */
  forMethodTesting(
    routineName: string,
    examples: RoutineTestExampleOptions[],
    options?: GenerateOptions,
  ): RoutineTestCase[] {
    const { includeBuiltIn = true } = options ?? {};

    // Generate method-specific cases
    const builtInMethodCases = includeBuiltIn ? this.generateMethodExamples(routineName) : [];
    const customMethodCases = this.generateMethodCustomExamples(routineName, examples);

    return this.#filterUniqueBy([...builtInMethodCases, ...customMethodCases], 'methodCall');
  }

  /**
   * Generates test cases from built-in function examples
   */
  generateFunctionExamples(routineName: string): RoutineTestCase[] {
    const functionDef = this.#registry.getFunction(routineName);

    if (!functionDef?.examples.length) {
      return [];
    }

    return functionDef.examples.map<RoutineTestCase>((example, index) => {
      const functionFormula = example.toFunctionCall();
      const methodFormula = example.toMethodCall();
      const dataType = this.#typeResolver.resolve(methodFormula, {});

      return {
        group: dataType?.constructor.name || 'function',
        name: `function example ${index + 1}: ${functionFormula}`,
        functionCall: functionFormula,
        methodCall: methodFormula,
        context: {},
        expected: example.result(),
      };
    });
  }

  /**
   * Generates test cases from custom function test examples
   */
  generateFunctionCustomExamples(routineName: string, examples?: RoutineTestExampleOptions[]): RoutineTestCase[] {
    if (!examples?.length) {
      return [];
    }

    return examples.reduce<RoutineTestCase[]>((acc, example) => {
      if (isExpectedError(example.expected) && !example.expected.function) {
        return acc;
      }

      const routineExample = new RoutineTestExample(routineName, example);
      const functionFormula = routineExample.toFunctionCall();
      const methodFormula = routineExample.toMethodCall();
      const dataType = this.#typeResolver.resolve(methodFormula, example.context ?? {});

      acc.push({
        group: dataType?.constructor.name || 'function',
        name: example.description || `function custom example ${acc.length + 1}: ${functionFormula}`,
        functionCall: functionFormula,
        methodCall: methodFormula,
        context: example.context ?? {},
        expected: example.expected,
      });

      return acc;
    }, []);
  }

  /**
   * Generates test cases from built-in method examples for all registered data types
   */
  generateMethodExamples(routineName: string): RoutineTestCase[] {
    const allTestCases: RoutineTestCase[] = [];
    const dataTypes = this.#registry.getRegisteredDataTypes();

    for (const constructor of dataTypes) {
      const methodDef = this.#registry.getMethod(constructor, routineName);

      if (!methodDef?.examples.length) {
        continue;
      }

      const methodTestCases = methodDef.examples.map<RoutineTestCase>((example, index) => {
        const dataType = this.#typeResolver.resolve(example.toMethodCall(), {});

        return {
          group: dataType?.constructor.name || constructor.name,
          name: `${dataType?.constructor.name || constructor.name} method example ${index + 1}: ${example.formula}`,
          functionCall: example.toFunctionCall(),
          methodCall: example.toMethodCall(),
          context: {},
          expected: example.result(),
        };
      });

      allTestCases.push(...methodTestCases);
    }

    return allTestCases;
  }

  /**
   * Generates test cases from custom method test examples for all registered data types
   */
  generateMethodCustomExamples(routineName: string, examples?: RoutineTestExampleOptions[]): RoutineTestCase[] {
    if (!examples?.length) {
      return [];
    }

    const allTestCases: RoutineTestCase[] = [];
    const dataTypes = this.#registry.getRegisteredDataTypes();

    for (const constructor of dataTypes) {
      let matchIndex = 0;

      for (const example of examples) {
        const routineExample = new RoutineTestExample(routineName, example);
        const dataType = this.#typeResolver.resolve(routineExample.toMethodCall(), routineExample.context ?? {});

        const isMatchingType = dataType?.constructor === constructor;
        const hasValidExpected = !isExpectedError(example.expected) || !!example.expected.method;

        if (!isMatchingType || !hasValidExpected) {
          continue;
        }

        matchIndex++;

        allTestCases.push({
          group: dataType?.constructor.name || constructor.name,
          name: routineExample.description || `${dataType?.constructor.name || constructor.name} method custom example ${matchIndex}: ${routineExample.formula}`,
          functionCall: routineExample.toFunctionCall(),
          methodCall: routineExample.toMethodCall(),
          context: routineExample.context ?? {},
          expected: routineExample.expected,
        });
      }
    }

    return allTestCases;
  }

  #filterUniqueBy(array: RoutineTestCase[], predicateProp: keyof RoutineTestCase): RoutineTestCase[] {
    const seen = new Map<string | undefined, RoutineTestCase>();

    for (const testCase of array) {
      const value = testCase[predicateProp] as string | undefined;
      if (value) {
        seen.set(value, testCase); // Last wins (preserves original findLastIndex behavior)
      }
    }

    return Array.from(seen.values());
  }
}
