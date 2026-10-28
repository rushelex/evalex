import type { AST } from '../../../parser';
import type { FormulaDataType } from '../../data-types';

import { FormulaArray, FormulaNumber } from '../../data-types';
import { Errors } from '../../errors';

interface CollectNumbersOptions {
  readonly values: readonly FormulaDataType[];
  readonly location: AST.Location;
}

/**
 * Flattens the arguments of an aggregate routine such as `sum` or `min` into a list of numbers.
 *
 * @remarks
 * Nested lists are flattened at any depth. An empty result is possible when every argument is an empty list.
 *
 * @throws FormulaError `AllMustBeNumbers`, pointing at `location`.
 */
export function collectNumbers({ values, location }: CollectNumbersOptions): FormulaNumber[] {
  const items = values.flatMap(flatten);

  if (items.some((item) => !(item instanceof FormulaNumber))) {
    throw Errors.Argument.AllMustBeNumbers.create({
      actual: items.map((item) => typeof item.value).join(', '),
    }, {
      location,
    });
  }

  return items as FormulaNumber[];
}

function flatten(value: FormulaDataType): FormulaDataType[] {
  return FormulaArray.isOfType(value) ? FormulaArray.flatValues(value) : [value];
}
