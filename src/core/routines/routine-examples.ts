import type { RoutineExampleOptions } from './routine-example';

import { RoutineExample } from './routine-example';

export class RoutineExamples {
  readonly routineName: string;
  readonly examples: RoutineExample[];

  constructor(
    routineName: string,
    examples: RoutineExampleOptions[],
  ) {
    this.routineName = routineName;
    this.examples = examples.map((options) => {
      return new RoutineExample(this.routineName, options);
    });
  }

  toFunctionExamples(): RoutineExample[] {
    return this.examples.map((example) => {
      const functionCall = example.toFunctionCall();

      if (example.formula === functionCall) {
        return example;
      }

      return new RoutineExample(this.routineName, {
        formula: () => functionCall,
        result: example.result,
      });
    });
  }

  toMethodExamples(): RoutineExample[] {
    return this.examples.map((example) => {
      const methodCall = example.toMethodCall();

      if (example.formula === methodCall) {
        return example;
      }

      return new RoutineExample(this.routineName, {
        formula: () => methodCall,
        result: example.result,
      });
    });
  }
}

export function createRoutineExamples(examples: RoutineExampleOptions[]): (routineName: string) => RoutineExamples {
  return (routineName: string) => {
    return new RoutineExamples(routineName, examples);
  };
}
