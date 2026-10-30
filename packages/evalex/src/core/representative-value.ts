import type { FormulaDataType } from './data-types';
import type { FormulaType } from './types';

import { Kind } from './data-types';
import { convertValueToFormulaType } from './data-types/converter';

const HOST_VALUES = {
  [Kind.Number]: () => 0,
  [Kind.String]: () => '',
  [Kind.Boolean]: () => false,
  [Kind.Null]: () => null,
  [Kind.Date]: () => Temporal.PlainDate.from('2000-01-01'),
  [Kind.DateTime]: () => Temporal.Instant.from('2000-01-01T00:00:00Z'),
  [Kind.Duration]: () => Temporal.Duration.from({ seconds: 0 }),
  [Kind.DateRange]: () => ({ start: Temporal.PlainDate.from('2000-01-01'), end: Temporal.PlainDate.from('2000-01-01') }),
  [Kind.RegExp]: () => /a/,
  [Kind.Object]: () => ({}),
} as const;

/**
 * A value of `formulaType`, standing in for any value of its kind where only the kind matters, as a call checks its
 * arguments.
 *
 * @remarks
 * A list holds one item when its items have one kind, so it shows as a list of them, as in an error naming the type of
 * the value; otherwise it is empty.
 *
 * @returns `undefined` for a type of several kinds or of any kind.
 */
export function representativeValue(formulaType: FormulaType): FormulaDataType | undefined {
  const value = hostValueOf(formulaType);

  return value === undefined ? undefined : convertValueToFormulaType(value);
}

function hostValueOf(formulaType: FormulaType): unknown {
  if (formulaType.kind === Kind.Array) {
    const item = hostValueOf(formulaType.items);

    return item === undefined ? [] : [item];
  }

  if (formulaType.kind === 'Union' || formulaType.kind === 'Nested' || formulaType.kind === 'Variable' || formulaType.kind === Kind.Any) {
    return undefined;
  }

  return HOST_VALUES[formulaType.kind]();
}
