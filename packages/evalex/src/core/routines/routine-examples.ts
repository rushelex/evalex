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

  /**
   * Returns the examples written as method calls.
   *
   * @param offsetsWrittenFor - the method name the error offsets of the examples were written for, when the routine has several
   */
  toMethodExamples(offsetsWrittenFor: string = this.routineName): RoutineExample[] {
    return this.examples.map((example) => {
      const methodCall = example.toMethodCall();
      const offsetsMoved = example.withMethodOffsetsFor(offsetsWrittenFor);

      if (example.formula === methodCall) {
        return offsetsMoved;
      }

      return offsetsMoved.withFormula(methodCall);
    });
  }
}
