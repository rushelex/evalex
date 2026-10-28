import type { FormulaArray } from './array';
import type { FormulaBoolean } from './boolean';
import type { FormulaDateRange } from './date-range';
import type { FormulaDateTime } from './date-time';
import type { FormulaDuration } from './duration';
import type { FormulaNull } from './null';
import type { FormulaNumber } from './number';
import type { FormulaObject } from './object';
import type { FormulaRegExp } from './regexp';
import type { FormulaString } from './string';

type AnyFormulaValue = FormulaArray | FormulaBoolean | FormulaDateTime | FormulaDateRange | FormulaDuration
  | FormulaNull | FormulaNumber | FormulaObject | FormulaRegExp | FormulaString;

describe('kind of a formula value', () => {
  it('should name the kind of each data type as a literal', () => {
    expectTypeOf<FormulaArray['kind']>().toEqualTypeOf<'Array'>();
    expectTypeOf<FormulaBoolean['kind']>().toEqualTypeOf<'Boolean'>();
    expectTypeOf<FormulaDateTime['kind']>().toEqualTypeOf<'DateTime'>();
    expectTypeOf<FormulaDateRange['kind']>().toEqualTypeOf<'DateRange'>();
    expectTypeOf<FormulaDuration['kind']>().toEqualTypeOf<'Duration'>();
    expectTypeOf<FormulaNull['kind']>().toEqualTypeOf<'Null'>();
    expectTypeOf<FormulaNumber['kind']>().toEqualTypeOf<'Number'>();
    expectTypeOf<FormulaObject['kind']>().toEqualTypeOf<'Object'>();
    expectTypeOf<FormulaRegExp['kind']>().toEqualTypeOf<'RegExp'>();
    expectTypeOf<FormulaString['kind']>().toEqualTypeOf<'String'>();
  });

  it('should narrow a value of any data type by its kind', () => {
    const narrow = (value: AnyFormulaValue): void => {
      if (value.kind === 'DateTime') {
        expectTypeOf(value.value).toEqualTypeOf<Temporal.ZonedDateTime>();
      }

      if (value.kind === 'Number') {
        expectTypeOf(value.value).toEqualTypeOf<number>();
      }

      if (value.kind === 'Array') {
        expectTypeOf(value).toEqualTypeOf<FormulaArray>();
      }
    };

    expectTypeOf(narrow).toBeFunction();
  });
});
