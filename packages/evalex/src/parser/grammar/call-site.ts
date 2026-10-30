/** A call of a function or method by name, as the parser read its argument list. */
export interface CallSite {
  /** The name called: a function name, or the method name after the dot. */
  readonly name: string;
  readonly form: 'function' | 'method';
  /** Offset just after `(`. */
  readonly open: number;
  /** Offset of `)`, or where the list stopped when the call is not closed. */
  readonly end: number;
  /** Offsets of the commas between the arguments. */
  readonly commas: readonly number[];
}
