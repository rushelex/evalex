import type { Class } from 'type-fest';
import type { TestAPI } from 'vitest';

import { test } from 'vitest';

import type { RoutineTestExampleOptions } from '../routine-test-example';
import type { RoutineTestCase } from './routine-test-generator';

import { evaluate } from '../../../testing-library';
import { FormulaDataType } from '../../data-types';
import { RoutineTestGenerator } from './routine-test-generator';

interface RunTestOptions {
  skipFunction?: boolean;
  skipMethod?: boolean;
}

export class RoutineTestRunner {
  constructor(
    private readonly routineName: string,
    private readonly testAPI: TestAPI = test,
  ) {}

  public testSuites(examples: RoutineTestExampleOptions[] = [], options: RunTestOptions = {}) {
    return (_testAPI: TestAPI) => {
      this.testAPI.scoped({ routineName: this.routineName });

      if (!options.skipFunction) {
        const functionTestCases = this.takeFunctionCases([
          ...RoutineTestGenerator.generateAllFunctionTestCases(this.routineName, examples),
        ]);
        this.runFunctionTestSuites(functionTestCases);
      }

      if (!options.skipMethod) {
        const methodTestCases = this.takeMethodCases([
          ...RoutineTestGenerator.generateAllFunctionTestCases(this.routineName, examples),
          ...RoutineTestGenerator.generateAllMethodTestCases(this.routineName, examples),
        ]);
        this.runMethodTestSuites(methodTestCases);
      }
    };
  }

  public onlyTestSuites(examples: RoutineTestExampleOptions[], options: RunTestOptions = {}) {
    return (_testAPI: TestAPI) => {
      this.testAPI.scoped({ routineName: this.routineName });

      if (!options.skipFunction) {
        const functionTestCases = this.takeFunctionCases([
          ...RoutineTestGenerator.generateFunctionTestExamples(this.routineName, examples),
        ]);
        this.runFunctionTestSuites(functionTestCases);
      }

      if (!options.skipMethod) {
        const methodTestCases = this.takeMethodCases([
          ...RoutineTestGenerator.generateFunctionTestExamples(this.routineName, examples),
          ...RoutineTestGenerator.generateMethodTestExamples(this.routineName, examples),
        ]);
        this.runMethodTestSuites(methodTestCases);
      }
    };
  }

  private runFunctionTestSuites(testCases: RoutineTestCase[]): void {
    this.testAPI.scoped({ routineName: this.routineName });

    describe('as function', () => {
      this.testAPI('should have at least 1 function test case', () => {
        expect(testCases.some((tc) => tc.functionCall)).toBeTruthy();
      });

      const successCases = this.takeSuccessCases(testCases);
      const throwingCases = this.takeThrowingCases(testCases);

      this.testAPI.for(successCases)('should work: $functionCall → $expected.value', async (testCase, { expect }) => {
        const result = evaluate(testCase.functionCall!, {
          context: testCase.context,
        });
        const expected = testCase.expected as FormulaDataType;
        expect(result).toBeFormulaDataType(expected.constructor as Class<FormulaDataType>, expected.value);
      });

      this.testAPI.for(throwingCases)('should throw: $functionCall → $expected.function.message at $expected.function.location', async (testCase, { expect }) => {
        const throwingFn = () => {
          evaluate(testCase.functionCall!, {
            context: testCase.context,
          });
        };
        if (!(testCase.expected instanceof FormulaDataType)) {
          expect(throwingFn).toThrowFormulaError(testCase.expected.function!.message, testCase.expected.function!.location);
        }
      });
    });
  }

  private runMethodTestSuites(testCases: RoutineTestCase[]): void {
    this.testAPI.scoped({ routineName: this.routineName });

    const groupedMethodCases = Object.entries(Object.groupBy(testCases, (tc) => tc.group));

    for (const [group, cases] of groupedMethodCases) {
      if (!cases?.length) {
        continue;
      }

      describe(`as ${group} method`, () => {
        const successCases = this.takeSuccessCases(cases);
        const throwingCases = this.takeThrowingCases(cases);

        this.testAPI.for(successCases)('should work: $methodCall → $expected.value', async (testCase, { expect }) => {
          const result = evaluate(testCase.methodCall!, {
            context: testCase.context,
          });
          const expected = testCase.expected as FormulaDataType;
          expect(result).toBeFormulaDataType(expected.constructor as Class<FormulaDataType>, expected.value);
        });

        this.testAPI.for(throwingCases)('should throw: $methodCall → $expected.method.message at $expected.method.location', async (testCase, { expect }) => {
          const throwingFn = () => {
            evaluate(testCase.methodCall!, {
              context: testCase.context,
            });
          };

          if (!(testCase.expected instanceof FormulaDataType)) {
            expect(throwingFn).toThrowFormulaError(testCase.expected.method!.message, testCase.expected.method!.location);
          }
        });
      });
    }
  }

  private takeSuccessCases(cases: RoutineTestCase[]): RoutineTestCase[] {
    return cases.filter((tc) => tc.expected instanceof FormulaDataType);
  }

  private takeThrowingCases(cases: RoutineTestCase[]): RoutineTestCase[] {
    return cases.filter((tc) => !(tc.expected instanceof FormulaDataType));
  }

  private takeFunctionCases(cases: RoutineTestCase[]): RoutineTestCase[] {
    return cases.filter((tc) => {
      return !!tc.functionCall && (tc.expected instanceof FormulaDataType || !!tc.expected.function);
    });
  }

  private takeMethodCases(cases: RoutineTestCase[]): RoutineTestCase[] {
    return cases.filter((tc) => {
      return tc.group !== 'function'
        && !!tc.methodCall
        && (tc.expected instanceof FormulaDataType || !!tc.expected.method);
    });
  }
}
