import type { Class } from 'type-fest';
import type { SuiteAPI, TestAPI } from 'vitest';

import { describe, test } from 'vitest';

import type { FormulaDataType } from '../../data-types';
import type { RoutineTestExampleOptions } from '../routine-test-example';
import type { GenerateOptions, RoutineTestCase } from './routine-test-generator';

import { evaluate } from '../../../testing-library';
import { routinesRegistry } from '../registry';
import { ASTBasedFormulaTypeResolver } from './formula-type-resolver';
import { RoutineTestGenerator } from './routine-test-generator';
import { isExpectedError, isExpectedSuccess } from './types';

interface RunExampleOptions {
  skipFunction?: boolean;
  skipMethod?: boolean;
}

/**
 * API for defining and verifying formula behavior through examples.
 *
 * This interface provides methods to specify how a formula should work by
 * documenting its expected inputs and outputs. Examples serve as living
 * documentation that also validates correctness.
 */
interface ExamplesAPI {
  /**
   * Specifies formula behavior using both built-in routine examples and custom examples.
   *
   * Built-in examples come from the routine's definition and cover standard use cases.
   * Custom examples allow you to document additional scenarios, edge cases, or
   * project-specific behavior.
   *
   * @param options - Configuration for example execution
   * @param options.skipFunction - When `true`, skips function-style syntax examples (e.g., `abs(-5)`)
   * @param options.skipMethod - When `true`, skips method-style syntax examples (e.g., `(-5).abs()`)
   * @param examples - Custom examples that document expected formula behavior
   * @returns A function that executes the example verification suite
   *
   * @example
   * ```ts
   * describe('abs', tester.examples(
   *   { skipMethod: true },
   *   [{ formula: 'abs(-10)', expected: new FormulaNumber(10) }]
   * ));
   * ```
   */
  (options: RunExampleOptions, examples: RoutineTestExampleOptions[]): () => void;

  /**
   * Specifies formula behavior using both built-in routine examples and custom examples.
   *
   * Built-in examples come from the routine's definition and cover standard use cases.
   * Custom examples allow you to document additional scenarios, edge cases, or
   * project-specific behavior.
   *
   * @param examples - Custom examples that document expected formula behavior
   * @returns A function that executes the example verification suite
   *
   * @example
   * ```ts
   * describe('abs', tester.examples([
   *   { formula: 'abs(-10)', expected: new FormulaNumber(10) },
   *   { formula: 'abs(0)', expected: new FormulaNumber(0) },
   * ]));
   * ```
   */
  (examples: RoutineTestExampleOptions[]): () => void;

  /**
   * Runs only the provided custom examples, excluding all built-in routine examples.
   *
   * Use this when you need to focus on specific scenarios without the noise of
   * built-in examples, or when built-in examples are not relevant to your context.
   */
  only: {
    /**
     * Specifies formula behavior using ONLY the provided custom examples.
     *
     * Unlike the default behavior, this excludes all built-in examples from the
     * routine definition. Useful for focused verification of specific scenarios.
     *
     * @param options - Configuration for example execution
     * @param options.skipFunction - When `true`, skips function-style syntax examples (e.g., `abs(-5)`)
     * @param options.skipMethod - When `true`, skips method-style syntax examples (e.g., `(-5).abs()`)
     * @param examples - Custom examples that document expected formula behavior
     * @returns A function that executes the example verification suite
     *
     * @example
     * ```ts
     * describe('abs', tester.examples.only(
     *   { skipMethod: true },
     *   [{ formula: 'abs(-10)', expected: new FormulaNumber(10) }]
     * ));
     * ```
     */
    (options: RunExampleOptions, examples: RoutineTestExampleOptions[]): () => void;

    /**
     * Specifies formula behavior using ONLY the provided custom examples.
     *
     * Unlike the default behavior, this excludes all built-in examples from the
     * routine definition. Useful for focused verification of specific scenarios.
     *
     * @param examples - Custom examples that document expected formula behavior
     * @returns A function that executes the example verification suite
     *
     * @example
     * ```ts
     * describe('abs', tester.examples.only([
     *   { formula: 'abs(-10)', expected: new FormulaNumber(10) },
     * ]));
     * ```
     */
    (examples: RoutineTestExampleOptions[]): () => void;
  };
}

export class RoutineTester {
  readonly #routineName: string;

  readonly #suite: SuiteAPI;
  readonly #test: TestAPI;

  readonly #generator: RoutineTestGenerator;

  constructor(
    routineName: string,
    suiteAPI: SuiteAPI = describe,
    testAPI: TestAPI = test,
  ) {
    this.#routineName = routineName;
    this.#suite = suiteAPI;
    this.#test = testAPI;
    this.#generator = new RoutineTestGenerator(
      routinesRegistry,
      new ASTBasedFormulaTypeResolver(),
    );
  }

  /**
   * API for defining and verifying formula behavior through examples.
   *
   * Examples serve as executable specifications that document how a formula works.
   * Each example captures an input formula and its expected output, creating
   * living documentation that validates correctness.
   *
   * By default, includes both built-in examples from the routine definition and
   * any custom examples you provide. Use `.only` to run only custom examples
   * without the built-in ones.
   *
   * @example Include built-in examples + custom examples
   * ```ts
   * describe('abs', tester.examples([
   *   { formula: 'abs(-10)', expected: new FormulaNumber(10) },
   * ]));
   * ```
   *
   * @example Only custom examples (no built-in)
   * ```ts
   * describe('abs', tester.examples.only([
   *   { formula: 'abs(-10)', expected: new FormulaNumber(10) },
   * ]));
   * ```
   */
  examples: ExamplesAPI = Object.assign(
    (optionsOrExamples: RunExampleOptions | RoutineTestExampleOptions[], examples?: RoutineTestExampleOptions[]) => {
      if (Array.isArray(optionsOrExamples)) {
        return this.#runExamplesTests(optionsOrExamples, undefined, { includeBuiltIn: true });
      }

      return this.#runExamplesTests(examples!, optionsOrExamples, { includeBuiltIn: true });
    },
    {
      only: (optionsOrExamples: RunExampleOptions | RoutineTestExampleOptions[], examples?: RoutineTestExampleOptions[]) => {
        if (Array.isArray(optionsOrExamples)) {
          return this.#runExamplesTests(optionsOrExamples, undefined, { includeBuiltIn: false });
        }

        return this.#runExamplesTests(examples!, optionsOrExamples, { includeBuiltIn: false });
      },
    },
  );

  #runExamplesTests(
    examples: RoutineTestExampleOptions[],
    runOptions?: RunExampleOptions,
    generateOptions?: GenerateOptions,
  ) {
    return () => {
      this.#test.scoped({ routineName: this.#routineName });

      if (!runOptions?.skipFunction) {
        const functionCases = this.#generator.forFunctionTesting(
          this.#routineName,
          examples,
          generateOptions,
        );
        this.#runFunctionTestSuites(functionCases);
      }

      if (!runOptions?.skipMethod) {
        const methodCases = this.#generator.forMethodTesting(
          this.#routineName,
          examples,
          generateOptions,
        );
        this.#runMethodTestSuites(methodCases);
      }
    };
  }

  #runFunctionTestSuites(testCases: RoutineTestCase[]): void {
    const functionTestCases = testCases.filter((tc) => {
      return !!tc.functionCall && (isExpectedSuccess(tc.expected) || !!tc.expected.function);
    });

    this.#suite('as function', () => {
      this.#test('should have at least 1 function test case', () => {
        expect(functionTestCases.some((tc) => tc.functionCall)).toBeTruthy();
      });

      const successCases = this.#takeSuccessCases(functionTestCases);
      const throwingCases = this.#takeThrowingCases(functionTestCases);

      this.#test.for(successCases)('should work: $functionCall → $expected.value', async (testCase, { expect }) => {
        const result = evaluate(testCase.functionCall!, {
          context: testCase.context,
        });
        const expected = testCase.expected as FormulaDataType;
        expect(result).toBeFormulaDataType(expected.constructor as Class<FormulaDataType>, expected.value);
      });

      this.#test.for(throwingCases)('should throw: $functionCall → $expected.function.message at $expected.function.location', async (testCase, { expect }) => {
        const throwingFn = () => {
          evaluate(testCase.functionCall!, {
            context: testCase.context,
          });
        };
        if (isExpectedError(testCase.expected)) {
          expect(throwingFn).toThrowFormulaError(testCase.expected.function!.message, testCase.expected.function!.location);
        }
      });
    });
  }

  #runMethodTestSuites(testCases: RoutineTestCase[]): void {
    const methodTestCases = testCases.filter((tc) => {
      return tc.group !== 'function'
        && !!tc.methodCall
        && (isExpectedSuccess(tc.expected) || !!tc.expected.method);
    });

    const groupedMethodCases = Object.entries(Object.groupBy(methodTestCases, (tc) => tc.group));

    for (const [group, cases] of groupedMethodCases) {
      if (!cases?.length) {
        continue;
      }

      this.#suite(`as ${group} method`, () => {
        const successCases = this.#takeSuccessCases(cases);
        const throwingCases = this.#takeThrowingCases(cases);

        this.#test.for(successCases)('should work: $methodCall → $expected.value', async (testCase, { expect }) => {
          const result = evaluate(testCase.methodCall!, {
            context: testCase.context,
          });
          const expected = testCase.expected as FormulaDataType;
          expect(result).toBeFormulaDataType(expected.constructor as Class<FormulaDataType>, expected.value);
        });

        this.#test.for(throwingCases)('should throw: $methodCall → $expected.method.message at $expected.method.location', async (testCase, { expect }) => {
          const throwingFn = () => {
            evaluate(testCase.methodCall!, {
              context: testCase.context,
            });
          };

          if (isExpectedError(testCase.expected)) {
            expect(throwingFn).toThrowFormulaError(testCase.expected.method!.message, testCase.expected.method!.location);
          }
        });
      });
    }
  }

  #takeSuccessCases(cases: RoutineTestCase[]): RoutineTestCase[] {
    return cases.filter((tc) => isExpectedSuccess(tc.expected));
  }

  #takeThrowingCases(cases: RoutineTestCase[]): RoutineTestCase[] {
    return cases.filter((tc) => isExpectedError(tc.expected));
  }
}
