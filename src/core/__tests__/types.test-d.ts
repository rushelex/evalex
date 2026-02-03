import type { Temporal } from 'temporal-polyfill';

import type { ToFormulaDataType } from '../data-types';

import type { FormulaArray } from '../data-types/array';

import type { FormulaBoolean } from '../data-types/boolean';
import type { FormulaDate } from '../data-types/date';
import type { FormulaDuration } from '../data-types/duration';
import type { FormulaNull } from '../data-types/null';
import type { FormulaNumber } from '../data-types/number';
import type { FormulaObject } from '../data-types/object';
import type { FormulaRegExp } from '../data-types/regexp';
import type { FormulaString } from '../data-types/string';

describe('ToFormulaDataType', () => {
  it('should map primitive and built-in supported types', () => {
    expectTypeOf<ToFormulaDataType<null>>().toEqualTypeOf<FormulaNull>();
    expectTypeOf<ToFormulaDataType<undefined>>().toEqualTypeOf<FormulaNull>();

    expectTypeOf<ToFormulaDataType<string>>().toEqualTypeOf<FormulaString>();
    expectTypeOf<ToFormulaDataType<number>>().toEqualTypeOf<FormulaNumber>();
    expectTypeOf<ToFormulaDataType<boolean>>().toEqualTypeOf<FormulaBoolean>();

    expectTypeOf<ToFormulaDataType<Date>>().toEqualTypeOf<FormulaDate>();
    expectTypeOf<ToFormulaDataType<Temporal.ZonedDateTime>>().toEqualTypeOf<FormulaDate>();

    expectTypeOf<ToFormulaDataType<Temporal.Duration>>().toEqualTypeOf<FormulaDuration>();
    expectTypeOf<ToFormulaDataType<RegExp>>().toEqualTypeOf<FormulaRegExp>();
  });

  it('should map arrays and readonly arrays', () => {
    expectTypeOf<ToFormulaDataType<string[]>>().toEqualTypeOf<FormulaArray<FormulaString>>();
    expectTypeOf<ToFormulaDataType<ReadonlyArray<number>>>().toEqualTypeOf<FormulaArray<FormulaNumber>>();
  });

  it('should map plain objects and wrap nested objects', () => {
    interface Input {
      a: string;
      nested: {
        b: number;
      };
    }

    interface Expected {
      a: FormulaString;
      nested: FormulaObject<{
        b: FormulaNumber;
      }>;
    }

    expectTypeOf<ToFormulaDataType<Input>>().toEqualTypeOf<Expected>();
  });

  it('should wrap objects into FormulaObject when requested', () => {
    interface Input {
      a: string;
    }

    type Expected = FormulaObject<{ a: FormulaString }>;

    expectTypeOf<ToFormulaDataType<Input, true>>().toEqualTypeOf<Expected>();
  });

  it('should map non-mappable object-like types to never', () => {
    expectTypeOf<ToFormulaDataType<Promise<string>>>().toEqualTypeOf<never>();
    expectTypeOf<ToFormulaDataType<Error>>().toEqualTypeOf<never>();

    expectTypeOf<ToFormulaDataType<Map<string, string>>>().toEqualTypeOf<never>();
    expectTypeOf<ToFormulaDataType<ReadonlyMap<string, string>>>().toEqualTypeOf<never>();

    expectTypeOf<ToFormulaDataType<Set<number>>>().toEqualTypeOf<never>();
    expectTypeOf<ToFormulaDataType<ReadonlySet<number>>>().toEqualTypeOf<never>();

    expectTypeOf<ToFormulaDataType<WeakMap<object, unknown>>>().toEqualTypeOf<never>();
    expectTypeOf<ToFormulaDataType<WeakSet<object>>>().toEqualTypeOf<never>();
  });

  it('should map functions and objects with methods to never', () => {
    type Fn = () => void;
    expectTypeOf<ToFormulaDataType<Fn>>().toEqualTypeOf<never>();

    interface ObjectWithMethod {
      a: number;
      foo: () => void;
    }

    expectTypeOf<ToFormulaDataType<ObjectWithMethod>>().toEqualTypeOf<never>();
  });

  it('should map class instances to never (best effort)', () => {
    class ExampleClass {
      readonly a = 1;

      foo(): void {
      }
    }

    expectTypeOf<ToFormulaDataType<ExampleClass>>().toEqualTypeOf<never>();
  });
});
