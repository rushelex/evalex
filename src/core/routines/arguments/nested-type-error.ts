import type { AST } from '../../../parser';
import type { FormulaDataType } from '../../data-types';
import type { FormulaError } from '../../errors';
import type { FormulaType } from '../../types';

import { FormulaArray } from '../../data-types';
import { Errors } from '../../errors';
import { admits, kindsOf } from '../../types';

/** The error of a value a nested type does not admit, naming the first value at any depth that is none of its items. */
export function nestedTypeError({ value, nested, position, location }: {
  readonly value: FormulaDataType;
  readonly nested: FormulaType & { readonly kind: 'Nested' };
  readonly position: number;
  readonly location: AST.Location;
}): FormulaError {
  const values = FormulaArray.isOfType(value) ? FormulaArray.flatValues(value) : [value];
  const stray = values.find((item) => !admits({ formulaType: nested.items, value: item })) ?? value;

  return Errors.Argument.NestedTypeMismatch.create({ expected: kindsOf(nested.items), actual: stray.kind, argumentPosition: position }, { location });
}
