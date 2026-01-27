import type { FormulaDataType } from '../data-types';

import { FormulaNull } from '../data-types';
import { RoutineExample } from './routine-example';

export interface RoutineTestExampleOptions {
  readonly formula: string;
  readonly description?: string;
  readonly context?: Record<string, FormulaDataType>;
  readonly expected: FormulaDataType | {
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

export class RoutineTestExample extends RoutineExample {
  public readonly expected: FormulaDataType | {
    function?: {
      message: string;
      location: [number, number];
    };
    method?: {
      message: string;
      location: [number, number];
    };
  };

  public readonly description?: string;

  public readonly context?: Record<string, FormulaDataType>;

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
