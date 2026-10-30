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

/**
 * Generates test cases for routine functions and methods from custom test examples.
 * Built-in routine examples run separately, for every registered routine.
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
   * Generates function-form test cases from custom examples.
   */
  forFunctionTesting(routineName: string, examples: RoutineTestExampleOptions[]): RoutineTestCase[] {
    return this.generateFunctionCustomExamples(routineName, examples);
  }

  /**
   * Generates method-form test cases from custom examples.
   */
  forMethodTesting(routineName: string, examples: RoutineTestExampleOptions[]): RoutineTestCase[] {
    return this.generateMethodCustomExamples(routineName, examples);
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
   * Generates test cases from custom method test examples for all registered data types
   */
  generateMethodCustomExamples(routineName: string, examples?: RoutineTestExampleOptions[]): RoutineTestCase[] {
    const dataTypes = this.#registry.getRegisteredDataTypes();

    // A routine without a method form, such as `pi()`, has no method cases.
    if (!dataTypes.some((dataType) => this.#registry.getMethod(dataType, routineName))) {
      return [];
    }

    return (examples ?? []).flatMap<RoutineTestCase>((example, index) => {
      if (isExpectedError(example.expected) && !example.expected.method) {
        return [];
      }

      const routineExample = new RoutineTestExample(routineName, example);
      const methodCall = routineExample.toMethodCall();
      const subject = this.#typeResolver.resolve(methodCall, routineExample.context ?? {});
      const ctor = dataTypes.find((dataType) => dataType === subject?.constructor);

      if (!ctor) {
        throw new Error(`Cannot determine the subject type of "${methodCall}"; pass the subject through \`context\`.`);
      }

      return [{
        group: ctor.name,
        name: routineExample.description || `${ctor.name} method custom example ${index + 1}: ${routineExample.formula}`,
        functionCall: routineExample.toFunctionCall(),
        methodCall,
        context: routineExample.context ?? {},
        expected: routineExample.expected,
      }];
    });
  }
}
