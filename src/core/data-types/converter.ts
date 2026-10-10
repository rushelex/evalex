import type { FormulaDataType } from './FormulaDataType';

import { FormulaArray } from './array';
import { FormulaBoolean } from './boolean';
import { FormulaDate } from './date';
import { FormulaDuration } from './duration';
import { FormulaNull } from './null';
import { FormulaNumber } from './number';
import { FormulaObject } from './object';
import { FormulaRegExp } from './regexp';
import { FormulaString } from './string';

/**
 * Convert object with circular reference detection
 */
export function convertObjectWithCircularCheck(obj: object, visited: WeakSet<object>): Record<string, FormulaDataType> {
  // `Object.fromEntries` defines each key as a field, so a `__proto__` key stays data instead of replacing the prototype.
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, convertValueToFormulaType(value, visited)]));
}

/**
 * Helper function to convert any value to appropriate FormulaDataType
 * Handles nested objects by creating FormulaObject instances with circular reference detection
 */
export function convertValueToFormulaType(value: any, visited: WeakSet<object> = new WeakSet()): FormulaDataType {
  if (value === null || value === undefined) {
    return new FormulaNull();
  }

  if (FormulaString.isValidInput(value)) {
    return FormulaString.from(value);
  }

  if (FormulaNumber.isValidInput(value)) {
    return FormulaNumber.from(value);
  }

  if (FormulaBoolean.isValidInput(value)) {
    return FormulaBoolean.from(value);
  }

  if (FormulaDate.isValidInput(value)) {
    return FormulaDate.from(value);
  }

  if (FormulaDuration.isValidInput(value)) {
    return FormulaDuration.from(value);
  }

  if (FormulaRegExp.isValidInput(value)) {
    return FormulaRegExp.from(value);
  }

  if (Array.isArray(value)) {
    // Check for circular reference
    if (visited.has(value)) {
      return new FormulaString('[Circular Reference]');
    }

    visited.add(value);
    // `Array.from` visits holes of a sparse list as `undefined`, which `map` skips.
    const convertedItems = Array.from(value, (item) => convertValueToFormulaType(item, visited));
    visited.delete(value);

    return new FormulaArray(convertedItems);
  }

  if (typeof value === 'function') {
    // eslint-disable-next-line ts/no-unsafe-function-type
    const name = (value as Function).name || 'anonymous';
    return new FormulaString(`[Function: ${name}]`);
  }

  if (typeof value === 'object' && value !== null) {
    // Check for circular reference BEFORE adding to visited
    if (visited.has(value as object)) {
      return new FormulaString('[Circular Reference]');
    }

    // Add to visited set before processing
    visited.add(value as object);

    try {
      // Create FormulaObject with the converted properties
      const convertedProps = convertObjectWithCircularCheck(value as object, visited);
      return new FormulaObject(convertedProps);
    }
    finally {
      // Always remove from visited set after processing
      visited.delete(value as object);
    }
  }

  // Fallback for unknown types
  return new FormulaString(String(value));
}
