import type { FormulaDataType } from '../data-types';
import type { ExpectedResult } from './test-helpers/types';

import { FormulaNull } from '../data-types';
import { RoutineExample } from './routine-example';

export interface RoutineTestExampleOptions {
  readonly formula: string;
  readonly description?: string;
  readonly context?: Record<string, FormulaDataType>;
  readonly expected: ExpectedResult;
}

export class RoutineTestExample extends RoutineExample {
  readonly expected: ExpectedResult;

  readonly description?: string;

  readonly context?: Record<string, FormulaDataType>;

  constructor(
    routineName: string,
    options: RoutineTestExampleOptions,
  ) {
    super(routineName, {
      formula: () => options.formula,
      result: () => new FormulaNull(),
    });

    this.description = options.description;
    this.context = options.context;
    this.expected = options.expected;
  }
}
