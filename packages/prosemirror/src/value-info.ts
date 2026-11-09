import type { FormulaValueAt } from 'evalex/language';

import type { FormulaService } from './formula-service';

/**
 * Writes what a part of a formula evaluates to on the sample record: its values, one per item where it is evaluated per
 * item, `—` where evaluation skips it, or the error it fails with.
 */
export function valueInfo({ value, service }: { value: FormulaValueAt; service: FormulaService }): HTMLElement {
  const dom = document.createElement('div');
  const values = value.values.map((item) => item.toString({ asJSON: true }));

  dom.className = value.error ? 'pm-formula-value pm-formula-value-error' : 'pm-formula-value';
  dom.textContent = value.error ? service.message(value.error) : `= ${values.length > 0 ? values.join(', ') : '—'}`;

  return dom;
}
