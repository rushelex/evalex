import type { ArgumentsPattern } from './arguments-definitions';

import { CallbackArgument } from './callback-argument';

export class RoutineArguments<const T extends ArgumentsPattern | ReadonlyArray<ArgumentsPattern> = ArgumentsPattern | ReadonlyArray<ArgumentsPattern>> {
  constructor(public readonly alternatives: T) {}

  public toMethodArgs() {
    const alts = this.alternatives;

    if (!alts.length) {
      return alts;
    }

    const [first] = alts;

    // Nested alternatives: ArgumentsPattern[]
    if (Array.isArray(first)) {
      const patterns = alts as ReadonlyArray<ArgumentsPattern>;

      let changed = false;

      const updated = patterns.map((pattern) => {
        const [head, ...tail] = pattern;

        if (head instanceof CallbackArgument) {
          return pattern;
        }

        if (!head.repeatable) {
          changed = true;
          return tail as ArgumentsPattern;
        }

        return pattern;
      });

      if (!changed) {
        return alts;
      }

      if (patterns.length > 0 && updated.every((p) => p.length === 0)) {
        return [] as ReadonlyArray<ArgumentsPattern>;
      }

      return updated;
    }

    // Single pattern: ArgumentsPattern
    const [head, ...tail] = alts as ArgumentsPattern;

    if (head instanceof CallbackArgument) {
      return alts;
    }

    if (!head.repeatable) {
      return tail as ArgumentsPattern;
    }

    return alts;
  }
}

export function createRoutineArguments<const T extends ArgumentsPattern | ReadonlyArray<ArgumentsPattern> = ArgumentsPattern | ReadonlyArray<ArgumentsPattern>>(alternatives: T) {
  return () => {
    return new RoutineArguments<T>(alternatives);
  };
}
