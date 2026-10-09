import type { RoutineExampleOptions } from './routine-example';

import { RoutineExample } from './routine-example';

export class RoutineExamples {
  readonly routineName: string;
  readonly examples: RoutineExample[];

  constructor(
    routineName: string,
    examples: readonly RoutineExampleOptions[],
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

      return example.withFormula(functionCall);
    });
  }

  toMethodExamples(): RoutineExample[] {
    return this.examples.map((example) => {
      const methodCall = example.toMethodCall();

      if (example.formula === methodCall) {
        return example;
      }

      return example.withFormula(methodCall);
    });
  }
}
