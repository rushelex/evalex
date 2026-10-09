import type { Class } from 'type-fest';
import type { SuiteAPI, TestAPI } from 'vitest';

import type { FormulaDataType } from '../../data-types';
import type { RoutineTestExampleOptions } from '../routine-test-example';
import type { RoutineTestCase } from './routine-test-generator';

import { describe, test } from 'vitest';

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
 * Runs custom examples of a routine in both call forms.
 *
 * @remarks
 * Built-in examples from the routine's definition run separately, for every registered routine,
 * so a test file only adds cases the definition does not cover.
 */
interface ExamplesAPI {
  /**
   * @param options - `skipFunction` / `skipMethod` skip one call form, for routines that have only the other one
   * @param examples - Custom examples that document expected formula behavior
   * @throws Error when a case would be silently dropped: an error expected for a skipped form, a repeated call text,
   * or a method call whose subject type cannot be determined
   *
   * @example
   * ```ts
   * describe('abs', tester.examples({ skipMethod: true }, [
   *   { formula: 'abs(-10)', expected: new FormulaNumber(10) },
   * ]));
   * ```
   */
  (options: RunExampleOptions, examples: RoutineTestExampleOptions[]): () => void;

  /**
   * @param examples - Custom examples that document expected formula behavior
   *
   * @example
   * ```ts
   * describe('abs', tester.examples([
   *   { formula: 'abs(-10)', expected: new FormulaNumber(10) },
   * ]));
   * ```
   */
  (examples: RoutineTestExampleOptions[]): () => void;
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

  examples: ExamplesAPI = (optionsOrExamples: RunExampleOptions | RoutineTestExampleOptions[], examples?: RoutineTestExampleOptions[]) => {
    if (Array.isArray(optionsOrExamples)) {
      return this.#runExamplesTests(optionsOrExamples);
    }

    return this.#runExamplesTests(examples!, optionsOrExamples);
  };

  #runExamplesTests(
    examples: RoutineTestExampleOptions[],
    runOptions?: RunExampleOptions,
  ) {
    assertNoSkippedErrors(examples, runOptions);

    return () => {
      this.#test.scoped({ routineName: this.#routineName });

      if (!runOptions?.skipFunction) {
        const functionCases = this.#generator.forFunctionTesting(
          this.#routineName,
          examples,
        );
        this.#runFunctionTestSuites(functionCases);
      }

      if (!runOptions?.skipMethod) {
        const methodCases = this.#generator.forMethodTesting(
          this.#routineName,
          examples,
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
          expect(throwingFn).toThrow(`${testCase.expected.function!.message} [${testCase.expected.function!.location[0]},${testCase.expected.function!.location[1]}]`);
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
            expect(throwingFn).toThrow(`${testCase.expected.method!.message} [${testCase.expected.method!.location[0]},${testCase.expected.method!.location[1]}]`);
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

function assertNoSkippedErrors(examples: RoutineTestExampleOptions[], runOptions: RunExampleOptions | undefined): void {
  for (const { formula, expected } of examples) {
    if (!isExpectedError(expected)) {
      continue;
    }

    if ((runOptions?.skipFunction && expected.function) || (runOptions?.skipMethod && expected.method)) {
      throw new Error(`The expected error of "${formula}" is for a call form this test skips.`);
    }
  }
}
