import type { Class } from 'type-fest';

import type { RoutineTestExampleOptions } from '../routine-test-example';

import { FormulaArray, FormulaBoolean, FormulaDataType, FormulaDate, FormulaDuration, FormulaNull, FormulaNumber, FormulaObject, FormulaRegExp, FormulaString } from '../../data-types';
import { convertValueToFormulaType } from '../../data-types/converter';
import { Expression } from '../../expression';
import { routinesRegistry } from '../registry';
import { RoutineTestExample } from '../routine-test-example';

export interface RoutineTestCase {
  group: 'function' | (string & {});
  name: string;
  functionCall?: string;
  methodCall?: string;
  context: Record<string, FormulaDataType>;
  expected: FormulaDataType | {
    function?: {
      message: string;
      location: [number, number];
    };
    method?: {
      message: string;
      location: [number, number];
    };
  };
}

export class RoutineTestGenerator {
  private static readonly ALL_DATA_TYPES = [
    FormulaArray,
    FormulaBoolean,
    FormulaDate,
    FormulaDuration,
    FormulaNull,
    FormulaNumber,
    FormulaObject,
    FormulaRegExp,
    FormulaString,
  ] satisfies Class<FormulaDataType>[];

  public static generateAllTestCases(routineName: string, examples: RoutineTestExampleOptions[] = []): RoutineTestCase[] {
    return [
      ...RoutineTestGenerator.generateAllFunctionTestCases(routineName, examples),
      ...RoutineTestGenerator.generateAllMethodTestCases(routineName, examples),
    ];
  }

  public static generateAllFunctionTestCases(routineName: string, examples: RoutineTestExampleOptions[] = []): RoutineTestCase[] {
    const allCases = [
      ...RoutineTestGenerator.generateFunctionExamples(routineName),
      ...RoutineTestGenerator.generateFunctionTestExamples(routineName, examples),
    ];

    return RoutineTestGenerator.filterUniqueBy(allCases, 'functionCall');
  }

  public static generateAllMethodTestCases(routineName: string, examples: RoutineTestExampleOptions[] = []): RoutineTestCase[] {
    const allCases = [
      ...RoutineTestGenerator.generateMethodExamples(routineName),
      ...RoutineTestGenerator.generateMethodTestExamples(routineName, examples),
    ];

    return RoutineTestGenerator.filterUniqueBy(allCases, 'methodCall');
  }

  public static generateFunctionExamples(routineName: string): RoutineTestCase[] {
    const functionDef = routinesRegistry.getFunction(routineName);

    if (!functionDef?.examples.length) {
      return [];
    }

    return functionDef.examples.map<RoutineTestCase>((example, index) => {
      const functionFormula = example.toFunctionCall();
      const methodFormula = example.toMethodCall();
      const dataType = this.parseDataType(methodFormula, {});

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

  public static generateFunctionTestExamples(routineName: string, examples: RoutineTestExampleOptions[] = []): RoutineTestCase[] {
    if (!examples.length) {
      return [];
    }

    return examples
      .filter((example) => example.expected instanceof FormulaDataType || !!example.expected.function)
      .map<RoutineTestCase>((example, index) => {
        const routineExample = new RoutineTestExample(routineName, example);
        const functionFormula = routineExample.toFunctionCall();
        const methodFormula = routineExample.toMethodCall();
        const dataType = this.parseDataType(methodFormula, example.context ?? {});

        return {
          group: dataType?.constructor.name || 'function',
          name: example.description || `function test example ${index + 1}: ${functionFormula}`,
          functionCall: functionFormula,
          methodCall: methodFormula,
          context: example.context ?? {},
          expected: example.expected,
        };
      });
  }

  public static generateMethodExamples(routineName: string): RoutineTestCase[] {
    const allTestCases: RoutineTestCase[] = [];

    for (const constructor of this.ALL_DATA_TYPES) {
      const methodDef = routinesRegistry.getMethod(constructor, routineName);

      if (!methodDef?.examples.length) {
        continue;
      }

      const methodTestCases = methodDef.examples.map<RoutineTestCase>((example, index) => {
        const dataType = this.parseDataType(example.toMethodCall(), {});

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

  public static generateMethodTestExamples(routineName: string, examples: RoutineTestExampleOptions[] = []): RoutineTestCase[] {
    const allTestCases: RoutineTestCase[] = [];

    for (const constructor of this.ALL_DATA_TYPES) {
      if (!examples.length) {
        continue;
      }

      const methodTestCases = examples
        .filter((example) => {
          const routineExample = new RoutineTestExample(routineName, example);
          const dataType = this.parseDataType(routineExample.toMethodCall(), routineExample.context ?? {});
          return dataType?.constructor === constructor && (example.expected instanceof FormulaDataType || !!example.expected.method);
        })
        .map<RoutineTestCase>((example, index) => {
          const routineExample = new RoutineTestExample(routineName, example);
          const dataType = this.parseDataType(routineExample.toMethodCall(), routineExample.context ?? {});

          return {
            group: dataType?.constructor.name || constructor.name,
            name: routineExample.description || `${dataType?.constructor.name || constructor.name} method test example ${index + 1}: ${routineExample.formula}`,
            functionCall: routineExample.toFunctionCall(),
            methodCall: routineExample.toMethodCall(),
            context: routineExample.context ?? {},
            expected: routineExample.expected,
          };
        });

      allTestCases.push(...methodTestCases);
    }

    return allTestCases;
  }

  private static filterUniqueBy(array: RoutineTestCase[], predicateProp: keyof RoutineTestCase): RoutineTestCase[] {
    return array.filter((tc, index, array) => {
      return tc[predicateProp] && array.findLastIndex((tc2) => tc2[predicateProp] === tc[predicateProp]) === index;
    });
  }

  /**
   * Parses formula to extract data type
   * [1,2,3].map(current * 2) -> FormulaArray
   * "hello".empty() -> FormulaString
   * emptyObj.empty() -> FormulaObject (if context is provided)
   */
  private static parseDataType(formula: string | undefined, context: Record<string, FormulaDataType>): FormulaDataType | undefined {
    if (!formula) {
      return;
    }

    const instance = this.parseInstance(formula);

    let dataType: FormulaDataType | undefined;

    if (instance instanceof FormulaDataType) {
      dataType = instance;
    }
    else if (context && instance?.dependencyName) {
      dataType = context[instance.dependencyName];
    }

    return dataType;
  }

  /**
   * Parses formula to extract instance
   * [1,2,3].map(current * 2) -> FormulaArray
   * "hello".empty() -> FormulaString
   * emptyObj.empty() -> { dependencyName: "emptyObj" }
   */
  private static parseInstance(formula: string): FormulaDataType | { dependencyName: string } | undefined {
    const expression = new Expression(formula);
    const ast = expression.parse();

    if (ast.type !== 'CallExpression') {
      return;
    }

    const instance = ast.callee;

    if (instance.type !== 'MemberExpression') {
      return;
    }

    const object = instance.object;

    if (object.type === 'Literal') {
      return convertValueToFormulaType(object.value);
    }

    if (object.type === 'ArrayExpression') {
      return convertValueToFormulaType(object.elements);
    }

    if (object.type === 'Identifier') {
      const dependencies = expression.extractDependencies(ast);

      if (dependencies.has(object.name)) {
        return { dependencyName: object.name };
      }
    }
  }
}
