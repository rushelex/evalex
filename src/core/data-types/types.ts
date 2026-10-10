import type { Temporal } from 'temporal-polyfill';

import type { FormulaArray } from './array';
import type { FormulaBoolean } from './boolean';
import type { FormulaDate } from './date';
import type { FormulaDateRange } from './date-range';
import type { FormulaDuration } from './duration';
import type { FormulaDataType } from './FormulaDataType';
import type { Kind } from './kind';
import type { FormulaNull } from './null';
import type { FormulaNumber } from './number';
import type { FormulaObject } from './object';
import type { FormulaRegExp } from './regexp';
import type { FormulaString } from './string';

type NonMappableObject
  = Function // eslint-disable-line ts/no-unsafe-function-type
    | Promise<unknown>
    | Error
    | Map<unknown, unknown>
    | ReadonlyMap<unknown, unknown>
    | Set<unknown>
    | ReadonlySet<unknown>
    | WeakMap<object, unknown>
    | WeakSet<object>;

type FunctionPropertyKeys<T extends object> = {
  [K in keyof T]-?: T[K] extends (...args: readonly unknown[]) => unknown ? K : never
}[keyof T];

type HasFunctionProperties<T extends object>
  = FunctionPropertyKeys<T> extends never ? false : true;

type MapObjectPropertiesToFormula<T> = { [K in keyof T]: ToFormulaDataType<T[K], true> };

type WrapObjectConditionally<T, ShouldWrap extends boolean>
  = ShouldWrap extends true
    ? FormulaObject<MapObjectPropertiesToFormula<T>>
    : MapObjectPropertiesToFormula<T>;

export type ToFormulaDataType<T, ShouldWrapObject extends boolean = false>
  = T extends null | undefined ? FormulaNull
  : T extends string ? FormulaString
  : T extends number ? FormulaNumber
  : T extends boolean ? FormulaBoolean
  : T extends Date | Temporal.ZonedDateTime ? FormulaDate
  : T extends Temporal.Duration ? FormulaDuration
  : T extends RegExp ? FormulaRegExp
  : T extends Array<infer I> | ReadonlyArray<infer I> ? FormulaArray<ToFormulaDataType<I, true>>
  : T extends object
    ? T extends NonMappableObject ? never
    : HasFunctionProperties<T> extends true ? never
    : WrapObjectConditionally<T, ShouldWrapObject>
    : never;

export type FormulaDataTypeByKind<T extends Kind>
  = T extends Kind.Null ? FormulaNull
  : T extends Kind.Boolean ? FormulaBoolean
  : T extends Kind.Number ? FormulaNumber
  : T extends Kind.String ? FormulaString
  : T extends Kind.Date ? FormulaDate
  : T extends Kind.Duration ? FormulaDuration
  : T extends Kind.DateRange ? FormulaDateRange
  : T extends Kind.RegExp ? FormulaRegExp
  : T extends Kind.Array ? FormulaArray
  : T extends Kind.Object ? FormulaObject
  : T extends Kind.Any ? FormulaDataType
  : never;
