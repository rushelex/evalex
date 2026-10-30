import type { AST } from '~/parser';

export function loc(start: number, end: number): AST.Location {
  return {
    start: { line: 1, offset: start, column: start + 1 },
    end: { line: 1, offset: end, column: end + 1 },
  };
}
