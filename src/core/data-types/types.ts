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

export type TypedArray
  = Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array
    | BigInt64Array
    | BigUint64Array;

type NonMappableObject
  = Function // eslint-disable-line ts/no-unsafe-function-type
    | Promise<unknown>
    | Error
    | Map<unknown, unknown>
    | ReadonlyMap<unknown, unknown>
    | WeakMap<object, unknown>
    | WeakSet<object>
    | ArrayBuffer
    | DataView
    | Temporal.PlainTime
    | Temporal.PlainYearMonth
    | Temporal.PlainMonthDay;

/** Values that convert without looking inside them. */
type ConvertibleLeaf
  = null
    | undefined
    | string
    | number
    | bigint
    | boolean
    | Date
    | Temporal.ZonedDateTime
    | Temporal.Instant
    | Temporal.PlainDateTime
    | Temporal.PlainDate
    | Temporal.Duration
    | RegExp
    | TypedArray
    | FormulaDataType;

/**
 * Host data as the converter accepts it: each value without a formula form becomes `never`, so passing it fails to compile.
 *
 * @remarks
 * Fields holding functions are left out, so a class instance passes with its methods. An own field holding a function
 * passes too, since a type cannot tell it from a method, and is rejected when converted. `unknown` and `any` pass as
 * they are: the converter checks them at run time.
 */
export type HostValue<T>
  = unknown extends T ? T
  : T extends ConvertibleLeaf ? T
  : T extends ReadonlyArray<infer I> ? ReadonlyArray<HostValue<I>>
  : T extends ReadonlySet<infer I> ? ReadonlySet<HostValue<I>>
  : T extends NonMappableObject ? never
  : T extends object ? { readonly [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: HostValue<T[K]> }
  : never;

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
  : T extends number | bigint ? FormulaNumber
  : T extends boolean ? FormulaBoolean
  : T extends Date | Temporal.ZonedDateTime | Temporal.Instant | Temporal.PlainDateTime | Temporal.PlainDate ? FormulaDate
  : T extends Temporal.Duration ? FormulaDuration
  : T extends RegExp ? FormulaRegExp
  : T extends Array<infer I> | ReadonlyArray<infer I> | ReadonlySet<infer I> ? FormulaArray<ToFormulaDataType<I, true>>
  : T extends TypedArray ? FormulaArray<FormulaNumber>
  : T extends object
    ? T extends NonMappableObject ? never
    : HasFunctionProperties<T> extends true ? never
    : WrapObjectConditionally<T, ShouldWrapObject>
    : never;

export type FormulaDataTypeByKind<T extends Kind>
  = T extends typeof Kind.Null ? FormulaNull
  : T extends typeof Kind.Boolean ? FormulaBoolean
  : T extends typeof Kind.Number ? FormulaNumber
  : T extends typeof Kind.String ? FormulaString
  : T extends typeof Kind.Date ? FormulaDate
  : T extends typeof Kind.Duration ? FormulaDuration
  : T extends typeof Kind.DateRange ? FormulaDateRange
  : T extends typeof Kind.RegExp ? FormulaRegExp
  : T extends typeof Kind.Array ? FormulaArray
  : T extends typeof Kind.Object ? FormulaObject
  : T extends typeof Kind.Any ? FormulaDataType
  : never;
