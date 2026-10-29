import type { CallSite } from './call-site';

/** What the caret is in, as the parser reads the text around it. */
export interface CaretPlace {
  /** `name` for a name read as a value, `method` for a method name after a dot, `string` for the text inside quotes. */
  readonly kind: 'name' | 'method' | 'string';
  /** Offset where the word or the text inside quotes starts. */
  readonly from: number;
  /** Offset where it ends, before the closing quote of a string. */
  readonly to: number;
  /** For a name, the `let` variables it can read, innermost first. */
  readonly variables: readonly string[];
  /** The calls whose parentheses hold the caret, innermost first. */
  readonly calls: readonly CallSite[];
}
