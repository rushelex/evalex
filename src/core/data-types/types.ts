import type { Temporal } from 'temporal-polyfill';

import type { FormulaArray } from './array';
import type { FormulaBoolean } from './boolean';
import type { FormulaDate } from './date';
import type { FormulaDuration } from './duration';
import type { FormulaDataType } from './FormulaDataType';
import type { Kind } from './kind';
import type { FormulaNull } from './null';
import type { FormulaNumber } from './number';
import type { FormulaObject } from './object';
import type { FormulaRegExp } from './regexp';
import type { FormulaString } from './string';

export type ToFormulaDataType<T, ShouldWrapObject extends boolean = false>
  = T extends null
    ? FormulaNull
    : T extends undefined
      ? FormulaNull
      : T extends string
        ? FormulaString
        : T extends number
          ? FormulaNumber
          : T extends boolean
            ? FormulaBoolean
            : T extends Date | Temporal.ZonedDateTime
              ? FormulaDate
              : T extends Temporal.Duration
                ? FormulaDuration
                : T extends RegExp
                  ? FormulaRegExp
                  : T extends Array<infer I> | ReadonlyArray<infer I>
                    ? FormulaArray<ToFormulaDataType<I, true>>
                    : T extends { [key in keyof T]: any }
                      ? ShouldWrapObject extends true
                        ? FormulaObject<{ [key in keyof T]: ToFormulaDataType<T[key], true> }>
                        : { [key in keyof T]: ToFormulaDataType<T[key], true> }
                      : never;

export type InferFormulaDataTypeByKind<T extends Kind>
  = T extends 'null'
    ? FormulaNull
    : T extends 'boolean'
      ? FormulaBoolean
      : T extends 'number'
        ? FormulaNumber
        : T extends 'string'
          ? FormulaString
          : T extends 'date'
            ? FormulaDate
            : T extends 'duration'
              ? FormulaDuration
              : T extends 'regexp'
                ? FormulaRegExp
                : T extends 'array'
                  ? FormulaArray
                  : T extends 'object'
                    ? FormulaObject
                    : T extends 'any'
                      ? FormulaDataType
                      : never;
