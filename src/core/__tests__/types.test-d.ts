import type { ToFormulaDataType } from '../data-types';

import type { FormulaArray } from '../data-types/array';

import type { FormulaBoolean } from '../data-types/boolean';
import type { FormulaDateTime } from '../data-types/date-time';
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

    expectTypeOf<ToFormulaDataType<Date>>().toEqualTypeOf<FormulaDateTime>();
    expectTypeOf<ToFormulaDataType<Temporal.ZonedDateTime>>().toEqualTypeOf<FormulaDateTime>();

    expectTypeOf<ToFormulaDataType<Temporal.Duration>>().toEqualTypeOf<FormulaDuration>();
    expectTypeOf<ToFormulaDataType<RegExp>>().toEqualTypeOf<FormulaRegExp>();
  });

  it('should map arrays and readonly arrays', () => {
    expectTypeOf<ToFormulaDataType<string[]>>().toEqualTypeOf<FormulaArray<FormulaString>>();
    expectTypeOf<ToFormulaDataType<ReadonlyArray<number>>>().toEqualTypeOf<FormulaArray<FormulaNumber>>();
  });

  it('should map values with an obvious formula form', () => {
    expectTypeOf<ToFormulaDataType<Set<number>>>().toEqualTypeOf<FormulaArray<FormulaNumber>>();
    expectTypeOf<ToFormulaDataType<ReadonlySet<string>>>().toEqualTypeOf<FormulaArray<FormulaString>>();
    expectTypeOf<ToFormulaDataType<Uint8Array>>().toEqualTypeOf<FormulaArray<FormulaNumber>>();
    expectTypeOf<ToFormulaDataType<BigInt64Array>>().toEqualTypeOf<FormulaArray<FormulaNumber>>();

    expectTypeOf<ToFormulaDataType<bigint>>().toEqualTypeOf<FormulaNumber>();

    expectTypeOf<ToFormulaDataType<Temporal.Instant>>().toEqualTypeOf<FormulaDateTime>();
    expectTypeOf<ToFormulaDataType<Temporal.PlainDateTime>>().toEqualTypeOf<FormulaDateTime>();
    expectTypeOf<ToFormulaDataType<Temporal.PlainDate>>().toEqualTypeOf<FormulaDateTime>();
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

    expectTypeOf<ToFormulaDataType<Temporal.PlainTime>>().toEqualTypeOf<never>();

    expectTypeOf<ToFormulaDataType<WeakMap<object, unknown>>>().toEqualTypeOf<never>();
    expectTypeOf<ToFormulaDataType<WeakSet<object>>>().toEqualTypeOf<never>();
  });

  it('should map a function to never', () => {
    type Fn = () => void;
    expectTypeOf<ToFormulaDataType<Fn>>().toEqualTypeOf<never>();
  });

  it('should leave out fields that hold functions', () => {
    interface ObjectWithMethod {
      a: number;
      foo: () => void;
    }

    expectTypeOf<ToFormulaDataType<ObjectWithMethod>>().toEqualTypeOf<{ a: FormulaNumber }>();
  });

  it('should map a class instance to its fields without methods', () => {
    class ExampleClass {
      readonly a = 1;

      foo(): void {
      }
    }

    expectTypeOf<ToFormulaDataType<ExampleClass>>().toEqualTypeOf<{ readonly a: FormulaNumber }>();
  });
});
