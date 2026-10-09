import type { FormulaDataType } from '../data-types';

import { parse } from '../../parser';

/** Offsets of a part of the formula, end exclusive. */
type Offsets = readonly [start: number, end: number];

/** The error a routine example fails with: documentation of a wrong call and a test of its message and range. */
export interface RoutineExampleError {
  /** Error definition from `Errors` the call fails with. */
  readonly type: { readonly is: (error: unknown) => boolean };
  /** Message as shown to the user, without the trailing offsets. */
  readonly message: string;
  /** The part of the formula at fault, for each form the routine has. */
  readonly location: { readonly function?: Offsets; readonly method?: Offsets };
}

interface RoutineExampleFormula {
  readonly formula: (createFormula: (...args: string[]) => string) => string;
}

/** A call written once with `name(subject, ...args)`, with either the value it returns or the error it fails with. */
export type RoutineExampleOptions = RoutineExampleFormula & (
  | { readonly result: () => FormulaDataType; readonly error?: never }
  | { readonly error: RoutineExampleError; readonly result?: never }
);

export class RoutineExample {
  readonly routineName: string;
  readonly formula: string;
  readonly result?: () => FormulaDataType;
  readonly error?: RoutineExampleError;
  readonly #options: RoutineExampleOptions;

  constructor(
    routineName: string,
    options: RoutineExampleOptions,
  ) {
    this.routineName = routineName;
    this.formula = options.formula((...args) => `${this.routineName}(${args.join(', ')})`);
    this.result = options.result;
    this.error = options.error;
    this.#options = options;
  }

  /** Returns the same example written as another formula, such as the other call form. */
  withFormula(formula: string): RoutineExample {
    return new RoutineExample(this.routineName, { ...this.#options, formula: () => formula });
  }

  /**
   * Transforms method call to function call
   * [1,2,3].format() -> format([1,2,3])
   * [1,2,3].map(current * 2) -> map([1,2,3], current * 2)
   */
  toFunctionCall(): string {
    const methodCallRegex = new RegExp(`(.+)\\.${this.routineName}\\s*\\((.*)?\\)`);
    const match = this.formula.match(methodCallRegex);

    if (!match) {
      return this.formula;
    }

    const instance = match[1]?.trim() || '';
    const args = match[2]?.trim() || '';

    if (args === '') {
      return `${this.routineName}(${instance})`;
    }
    else {
      return `${this.routineName}(${instance}, ${args})`;
    }
  }

  /**
   * Transforms function call to method call
   * format([1,2,3]) -> [1,2,3].format()
   * map([1,2,3], current * 2) -> [1,2,3].map(current * 2)
   */
  toMethodCall(): string {
    const functionCallRegex = new RegExp(`\\s?${this.routineName}\\s*\\((.*)?\\)`);
    const match = this.formula.match(functionCallRegex);

    if (!match) {
      return this.formula;
    }

    if (!this.formula.startsWith(this.routineName)) {
      return this.formula;
    }

    if (!match[1]) {
      return this.formula;
    }

    const args = this.#parseArguments(match[1]);
    const firstArg = wrapCompoundSubject(args[0]);
    const restArgs = args.slice(1);

    if (restArgs.length === 0) {
      return `${firstArg}.${this.routineName}()`;
    }
    else {
      return `${firstArg}.${this.routineName}(${restArgs.join(', ')})`;
    }
  }

  /**
   * Parses arguments string
   * [1,2,3].map(current * 2) -> ["[1,2,3]", "current * 2"]
   * "hello".empty() -> ["hello"]
   * emptyObj.empty() -> ["emptyObj"]
   */
  #parseArguments(argsString: string): string[] {
    const args: string[] = [];
    let currentArg = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      const prevChar = i > 0 ? argsString[i - 1] : '';

      // Handle string literals
      if ((char === '"' || char === '\'') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        }
        else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }

      // Skip processing if we're inside a string
      if (inString) {
        currentArg += char;
        continue;
      }

      // Handle nested structures
      if (char === '[' || char === '(' || char === '{') {
        depth++;
      }
      else if (char === ']' || char === ')' || char === '}') {
        depth--;
      }

      // Split on comma only at top level (depth 0)
      if (char === ',' && depth === 0) {
        args.push(currentArg.trim());
        currentArg = '';
      }
      else {
        currentArg += char;
      }
    }

    // Add the last argument
    if (currentArg.trim()) {
      args.push(currentArg.trim());
    }

    return args;
  }
}

// `-1.sum()` parses as `-(1.sum())`, so a subject that is not a primary expression needs parentheses.
function wrapCompoundSubject(subject: string): string {
  let type: string;

  try {
    ({ type } = parse(subject));
  }
  catch {
    // Text that is not a formula, such as an object written as `{ a: 1 }`, is left as is.
    return subject;
  }

  const isPrimary = type === 'Literal' || type === 'Identifier' || type === 'ArrayExpression' || type === 'CallExpression' || type === 'MemberExpression';

  return isPrimary ? subject : `(${subject})`;
}
