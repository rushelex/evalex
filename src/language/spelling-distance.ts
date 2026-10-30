/**
 * Counts the typing mistakes between two names, ignoring case: characters inserted, deleted, replaced, or two
 * neighbors swapped, each one mistake.
 */
export function spellingDistance({ typed, meant }: { readonly typed: string; readonly meant: string }): number {
  const a = [...typed.toLowerCase()];
  const b = [...meant.toLowerCase()];
  // rows[i][j] is the distance between the first i characters of `a` and the first j of `b`
  const rows = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (__, j) => (i === 0 ? j : i)));

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const replaced = rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      const swapped = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? rows[i - 2][j - 2] + 1 : Infinity;

      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, replaced, swapped);
    }
  }

  return rows[a.length][b.length];
}
