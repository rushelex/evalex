import type { ToStringOptions } from '../FormulaDataType';

import { FormulaDataType } from '../FormulaDataType';
import { Kind } from '../kind';

interface RegExpData {
  pattern: string;
  flags: string;
}

/**
 * A regular expression a formula computes, such as `/\d+/g`: `value` holds its pattern and flags as text.
 *
 * @remarks
 * It carries no state between uses, such as the `lastIndex` of a `RegExp`, so the same formula matches the same way
 * every time.
 */
export class FormulaRegExp extends FormulaDataType<RegExpData, typeof Kind.RegExp> {
  static readonly kind = Kind.RegExp;

  /**
   * Creates a FormulaRegExp instance.
   * @param pattern Regular expression pattern string or RegExp object
   * @param flags Optional flags string (ignored if pattern is RegExp)
   */
  constructor(pattern: string | RegExp, flags?: string) {
    let regexpData: RegExpData;

    if (pattern instanceof RegExp) {
      regexpData = {
        pattern: pattern.source,
        flags: pattern.flags,
      };
    }
    else {
      regexpData = {
        pattern,
        flags: flags || '',
      };
    }

    super(Kind.RegExp, regexpData, 'RegExp');
  }

  /**
   * Gets the pattern string.
   */
  get pattern(): string {
    return this.value.pattern;
  }

  /**
   * Gets the flags string.
   */
  get flags(): string {
    return this.value.flags;
  }

  /**
   * Creates a fresh RegExp instance for use in operations.
   * This ensures no stateful behavior from RegExp.exec().
   */
  toRegExp(): RegExp {
    return new RegExp(this.value.pattern, this.value.flags);
  }

  isEmpty(): boolean {
    return this.value.pattern.length === 0;
  }

  toString(options?: ToStringOptions): string {
    const regexStr = `/${this.value.pattern}/${this.value.flags}`;
    return options?.asJSON ? `"${regexStr}"` : regexStr;
  }

  /**
   * Creates a FormulaRegExp from a pattern string and optional flags.
   */
  static from(pattern: string | RegExp | RegExpData, flags?: string): FormulaRegExp {
    if (pattern instanceof RegExp) {
      return new FormulaRegExp(pattern.source, pattern.flags);
    }

    if (typeof pattern === 'string') {
      return new FormulaRegExp(pattern, flags);
    }

    console.warn('"flags" argument will be ignored when creating FormulaRegExp from RegExpData.');

    return new FormulaRegExp(pattern.pattern, pattern.flags);
  }

  /**
   * Checks if the input is a valid RegExp object.
   */
  static isValidInput(input: unknown): input is RegExp {
    return input instanceof RegExp;
  }
}
