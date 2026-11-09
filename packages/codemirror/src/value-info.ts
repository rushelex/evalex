import type { FormulaDiagnostic, FormulaValueAt } from 'evalex/language';

/**
 * Writes what a part of a formula evaluates to on the sample record: its values, one per item where it is evaluated per
 * item, `—` where evaluation skips it, or the error it fails with.
 */
export function valueInfo({ value, message = ({ message: english }) => english }: {
  value: FormulaValueAt;
  message: ((diagnostic: FormulaDiagnostic) => string) | undefined;
}): HTMLElement {
  const dom = document.createElement('div');
  const values = value.values.map((item) => item.toString({ asJSON: true }));

  dom.className = value.error ? 'cm-formula-value cm-formula-value-error' : 'cm-formula-value';
  dom.textContent = value.error ? message(value.error) : `= ${values.length > 0 ? values.join(', ') : '—'}`;

  return dom;
}
