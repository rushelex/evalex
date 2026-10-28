/** The span of formula text a node or an error covers, as offsets and as lines and columns counted from 1. */
export interface FormulaLocation {
  start: { offset: number; line: number; column: number };
  end: { offset: number; line: number; column: number };
}
