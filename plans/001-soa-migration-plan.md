# SoA Migration Plan: Formula Engine Optimization

## Executive Summary

This document outlines a comprehensive plan for migrating the formula engine's internal data representation from **AoS (Array of Structures)** to **SoA (Structure of Arrays)** while preserving the public API. The goal is to achieve 5-10x performance improvement for high-volume formula evaluation scenarios.

### Current State
- Each formula value creates a class instance (`FormulaNumber`, `FormulaString`, etc.)
- 1000 formulas can create 100K+ objects
- High GC pressure and memory fragmentation

### Target State
- Internal computation uses `ValueRef` (indices into typed arrays)
- Public API remains unchanged (`FormulaDataType` classes)
- Conversion only at API boundaries

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: Foundation](#2-phase-1-foundation-2-weeks)
3. [Phase 2: Core Migration](#3-phase-2-core-migration-3-weeks)
4. [Phase 3: Runtime Integration](#4-phase-3-runtime-integration-2-weeks)
5. [Phase 4: Optimization](#5-phase-4-optimization-2-weeks)
6. [Phase 5: Stabilization](#6-phase-5-stabilization-1-week)
7. [Risk Mitigation](#7-risk-mitigation)
8. [Rollback Strategy](#8-rollback-strategy)
9. [Success Metrics](#9-success-metrics)

---

## 1. Architecture Overview

### 1.1 Current Architecture (AoS)

```
┌──────────────────────────────────────────────────────────────────┐
│                          evaluate("1 + 2")                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │
│  │ FormulaNumber  │  │ FormulaNumber  │  │ FormulaNumber  │     │
│  │ {kind, value}  │  │ {kind, value}  │  │ {kind, value}  │     │
│  │ value: 1       │  │ value: 2       │  │ value: 3       │     │
│  └────────────────┘  └────────────────┘  └────────────────┘     │
│        ↑                    ↑                    ↑               │
│   Allocation #1        Allocation #2        Allocation #3        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Problems:**
- Each object is a separate heap allocation
- Hidden class creation overhead
- GC pressure from short-lived intermediates
- Poor cache locality

### 1.2 Target Architecture (SoA)

```
┌──────────────────────────────────────────────────────────────────┐
│                          evaluate("1 + 2")                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FormulaValueStore                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ kinds:   Uint8Array   [2, 2, 2, ...]     ← Kind.Number     │ │
│  │ numbers: Float64Array [1, 2, 3, ...]     ← Actual values   │ │
│  │ size: 3                                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Result: ValueRef = 2 (index pointing to value 3)               │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │ toPublicValue()  │  → FormulaNumber(3) (only at API boundary)│
│  └──────────────────┘                                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Single allocation for arrays (grows as needed)
- Sequential memory access
- CPU cache-friendly iteration
- Minimal GC pressure

### 1.3 Hybrid Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            PUBLIC API                                    │
│  Expression.evaluate() → EvaluateResult { result: FormulaDataType }     │
├─────────────────────────────────────────────────────────────────────────┤
│                         BOUNDARY LAYER                                   │
│  toPublicValue(store, ref) ← Converts ValueRef to FormulaDataType       │
│  toInternalRef(store, value) ← Converts FormulaDataType to ValueRef     │
├─────────────────────────────────────────────────────────────────────────┤
│                         INTERNAL LAYER (SoA)                            │
│  FormulaValueStore                                                       │
│  FormulaEvaluatorVisitorInternal                                        │
│  CallbackExecutorInternal                                               │
│  RoutineDispatcherInternal                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Foundation (2 weeks)

### 2.1 Create ValueStore Core

**File:** `src/core/value-store/value-store.ts`

```typescript
/**
 * Kind enumeration using numbers for fast comparison
 */
export const enum Kind {
  Null = 0,
  Boolean = 1,
  Number = 2,
  String = 3,
  Date = 4,
  Duration = 5,
  Array = 6,
  Object = 7,
  RegExp = 8,
}

/**
 * Branded type for value references (indices into the store)
 */
export type ValueRef = number & { readonly __brand: unique symbol };

/**
 * Main value store using Structure of Arrays layout
 */
export class FormulaValueStore {
  // Type of each value (1 byte per value)
  private kinds: Uint8Array;

  // Boolean values (1 byte per value, 0 or 1)
  private booleans: Uint8Array;

  // Number values (8 bytes per value, IEEE 754)
  private numbers: Float64Array;

  // String indices (4 bytes per value, index into stringPool)
  private stringIndices: Uint32Array;
  private stringPool: string[] = [];
  private stringIntern: Map<string, number> = new Map();

  // Timestamp for dates (8 bytes per value)
  private timestamps: Float64Array;

  // Duration in milliseconds (8 bytes per value)
  private durations: Float64Array;

  // Complex types indices (4 bytes per value)
  private complexIndices: Uint32Array;
  private arrays: ValueRef[][] = [];
  private objects: Map<string, ValueRef>[] = [];
  private regexps: { pattern: string; flags: string }[] = [];

  // Current size and capacity
  private size = 0;
  private capacity: number;

  // Pre-allocated constants
  readonly NULL: ValueRef;
  readonly TRUE: ValueRef;
  readonly FALSE: ValueRef;
  readonly ZERO: ValueRef;
  readonly ONE: ValueRef;
  readonly EMPTY_STRING: ValueRef;

  constructor(initialCapacity = 1024) {
    this.capacity = initialCapacity;
    this.allocateArrays(initialCapacity);

    // Pre-allocate constants
    this.NULL = this.createNull();
    this.FALSE = this.createBoolean(false);
    this.TRUE = this.createBoolean(true);
    this.ZERO = this.createNumber(0);
    this.ONE = this.createNumber(1);
    this.EMPTY_STRING = this.createString('');
  }

  // ... implementation details below
}
```

### 2.2 Implement Value Creation Methods

```typescript
// In FormulaValueStore class

createNull(): ValueRef {
  const ref = this.allocate();
  this.kinds[ref] = Kind.Null;
  return ref;
}

createBoolean(value: boolean): ValueRef {
  // Return cached constants
  if (this.size > 2) {
    return value ? this.TRUE : this.FALSE;
  }
  const ref = this.allocate();
  this.kinds[ref] = Kind.Boolean;
  this.booleans[ref] = value ? 1 : 0;
  return ref;
}

createNumber(value: number): ValueRef {
  // Check for cached constants
  if (value === 0 && this.size > 4) return this.ZERO;
  if (value === 1 && this.size > 5) return this.ONE;

  const ref = this.allocate();
  this.kinds[ref] = Kind.Number;
  this.numbers[ref] = value;
  return ref;
}

createString(value: string): ValueRef {
  // Return cached empty string
  if (value === '' && this.size > 6) return this.EMPTY_STRING;

  const ref = this.allocate();
  this.kinds[ref] = Kind.String;
  this.stringIndices[ref] = this.internString(value);
  return ref;
}

createDate(timestamp: number): ValueRef {
  const ref = this.allocate();
  this.kinds[ref] = Kind.Date;
  this.timestamps[ref] = timestamp;
  return ref;
}

createDuration(milliseconds: number): ValueRef {
  const ref = this.allocate();
  this.kinds[ref] = Kind.Duration;
  this.durations[ref] = milliseconds;
  return ref;
}

createArray(items: ValueRef[]): ValueRef {
  const ref = this.allocate();
  this.kinds[ref] = Kind.Array;
  this.complexIndices[ref] = this.arrays.length;
  this.arrays.push(items);
  return ref;
}

createObject(properties: Map<string, ValueRef>): ValueRef {
  const ref = this.allocate();
  this.kinds[ref] = Kind.Object;
  this.complexIndices[ref] = this.objects.length;
  this.objects.push(properties);
  return ref;
}

createRegExp(pattern: string, flags: string): ValueRef {
  const ref = this.allocate();
  this.kinds[ref] = Kind.RegExp;
  this.complexIndices[ref] = this.regexps.length;
  this.regexps.push({ pattern, flags });
  return ref;
}
```

### 2.3 Implement Value Reading Methods

```typescript
// In FormulaValueStore class

getKind(ref: ValueRef): Kind {
  return this.kinds[ref];
}

getBoolean(ref: ValueRef): boolean {
  return this.booleans[ref] === 1;
}

getNumber(ref: ValueRef): number {
  return this.numbers[ref];
}

getString(ref: ValueRef): string {
  return this.stringPool[this.stringIndices[ref]];
}

getTimestamp(ref: ValueRef): number {
  return this.timestamps[ref];
}

getDuration(ref: ValueRef): number {
  return this.durations[ref];
}

getArray(ref: ValueRef): ValueRef[] {
  return this.arrays[this.complexIndices[ref]];
}

getObject(ref: ValueRef): Map<string, ValueRef> {
  return this.objects[this.complexIndices[ref]];
}

getRegExp(ref: ValueRef): { pattern: string; flags: string } {
  return this.regexps[this.complexIndices[ref]];
}
```

### 2.4 Type Guards

```typescript
// In FormulaValueStore class

isNull(ref: ValueRef): boolean {
  return this.kinds[ref] === Kind.Null;
}

isBoolean(ref: ValueRef): boolean {
  return this.kinds[ref] === Kind.Boolean;
}

isNumber(ref: ValueRef): boolean {
  return this.kinds[ref] === Kind.Number;
}

isString(ref: ValueRef): boolean {
  return this.kinds[ref] === Kind.String;
}

isDate(ref: ValueRef): boolean {
  return this.kinds[ref] === Kind.Date;
}

isDuration(ref: ValueRef): boolean {
  return this.kinds[ref] === Kind.Duration;
}

isArray(ref: ValueRef): boolean {
  return this.kinds[ref] === Kind.Array;
}

isObject(ref: ValueRef): boolean {
  return this.kinds[ref] === Kind.Object;
}

isRegExp(ref: ValueRef): boolean {
  return this.kinds[ref] === Kind.RegExp;
}
```

### 2.5 Utility Methods

```typescript
// In FormulaValueStore class

isEmpty(ref: ValueRef): boolean {
  switch (this.kinds[ref]) {
    case Kind.Null:
      return true;
    case Kind.Boolean:
      return !this.booleans[ref];
    case Kind.Number:
      return this.numbers[ref] === 0;
    case Kind.String:
      return this.getString(ref).length === 0;
    case Kind.Array:
      return this.getArray(ref).length === 0;
    case Kind.Object:
      return this.getObject(ref).size === 0;
    default:
      return false;
  }
}

toString(ref: ValueRef): string {
  switch (this.kinds[ref]) {
    case Kind.Null:
      return '';
    case Kind.Boolean:
      return this.booleans[ref] ? 'true' : 'false';
    case Kind.Number:
      return String(this.numbers[ref]);
    case Kind.String:
      return this.getString(ref);
    case Kind.Date:
      return new Date(this.timestamps[ref]).toISOString();
    case Kind.Duration:
      return `${this.durations[ref]}ms`;
    case Kind.Array:
      return `[${this.getArray(ref).map(r => this.toString(r)).join(', ')}]`;
    case Kind.Object:
      const obj = this.getObject(ref);
      const entries = Array.from(obj.entries())
        .map(([k, v]) => `${k}: ${this.toString(v)}`)
        .join(', ');
      return `{ ${entries} }`;
    case Kind.RegExp:
      const { pattern, flags } = this.getRegExp(ref);
      return `/${pattern}/${flags}`;
    default:
      return '[unknown]';
  }
}

// Get raw value for comparisons
getValue(ref: ValueRef): unknown {
  switch (this.kinds[ref]) {
    case Kind.Null:
      return null;
    case Kind.Boolean:
      return this.booleans[ref] === 1;
    case Kind.Number:
      return this.numbers[ref];
    case Kind.String:
      return this.getString(ref);
    case Kind.Date:
      return this.timestamps[ref];
    case Kind.Duration:
      return this.durations[ref];
    default:
      return undefined;
  }
}
```

### 2.6 Memory Management

```typescript
// In FormulaValueStore class

private allocate(): ValueRef {
  if (this.size >= this.capacity) {
    this.grow();
  }
  return this.size++ as ValueRef;
}

private grow(): void {
  const newCapacity = this.capacity * 2;
  this.allocateArrays(newCapacity);
}

private allocateArrays(capacity: number): void {
  const copyFrom = this.kinds ? this.size : 0;

  this.kinds = this.growTypedArray(this.kinds, capacity, Uint8Array);
  this.booleans = this.growTypedArray(this.booleans, capacity, Uint8Array);
  this.numbers = this.growTypedArray(this.numbers, capacity, Float64Array);
  this.stringIndices = this.growTypedArray(this.stringIndices, capacity, Uint32Array);
  this.timestamps = this.growTypedArray(this.timestamps, capacity, Float64Array);
  this.durations = this.growTypedArray(this.durations, capacity, Float64Array);
  this.complexIndices = this.growTypedArray(this.complexIndices, capacity, Uint32Array);

  this.capacity = capacity;
}

private growTypedArray<T extends TypedArray>(
  existing: T | undefined,
  newSize: number,
  Ctor: new (size: number) => T
): T {
  const newArray = new Ctor(newSize);
  if (existing) {
    newArray.set(existing);
  }
  return newArray;
}

private internString(value: string): number {
  let index = this.stringIntern.get(value);
  if (index === undefined) {
    index = this.stringPool.length;
    this.stringPool.push(value);
    this.stringIntern.set(value, index);
  }
  return index;
}

/**
 * Reset store for reuse (arena-style allocation)
 * Preserves capacity and string pool
 */
reset(): void {
  // Keep constants at the beginning
  this.size = 7; // NULL, FALSE, TRUE, ZERO, ONE, EMPTY_STRING + 1

  // Clear complex type pools
  this.arrays.length = 0;
  this.objects.length = 0;
  this.regexps.length = 0;

  // String pool can be preserved for better interning
}

type TypedArray = Uint8Array | Uint32Array | Float64Array;
```

### 2.7 Tasks Checklist for Phase 1

- [ ] Create `src/core/value-store/` directory
- [ ] Implement `FormulaValueStore` class
- [ ] Implement all Kind types
- [ ] Implement value creation methods
- [ ] Implement value reading methods
- [ ] Implement type guards
- [ ] Implement utility methods (isEmpty, toString)
- [ ] Implement memory management (grow, reset)
- [ ] Write unit tests for FormulaValueStore
- [ ] Benchmark: compare creation speed with current approach

---

## 3. Phase 2: Core Migration (3 weeks)

### 3.1 Create Boundary Converters

**File:** `src/core/value-store/converters.ts`

```typescript
import type { FormulaDataType } from '../data-types';
import type { FormulaValueStore, ValueRef, Kind } from './value-store';

import { FormulaNull } from '../data-types/null';
import { FormulaBoolean } from '../data-types/boolean';
import { FormulaNumber } from '../data-types/number';
import { FormulaString } from '../data-types/string';
import { FormulaDate } from '../data-types/date';
import { FormulaDuration } from '../data-types/duration';
import { FormulaArray } from '../data-types/array';
import { FormulaObject } from '../data-types/object';
import { FormulaRegExp } from '../data-types/regexp';

/**
 * Converts a ValueRef from the internal store to a public FormulaDataType
 */
export function toPublicValue(store: FormulaValueStore, ref: ValueRef): FormulaDataType {
  const kind = store.getKind(ref);

  switch (kind) {
    case Kind.Null:
      return FormulaNull.instance();

    case Kind.Boolean:
      return FormulaBoolean.from(store.getBoolean(ref));

    case Kind.Number:
      return FormulaNumber.from(store.getNumber(ref));

    case Kind.String:
      return FormulaString.from(store.getString(ref));

    case Kind.Date:
      return FormulaDate.from(new Date(store.getTimestamp(ref)));

    case Kind.Duration:
      return FormulaDuration.from(Temporal.Duration.from({
        milliseconds: store.getDuration(ref)
      }));

    case Kind.Array: {
      const items = store.getArray(ref);
      const convertedItems = items.map(itemRef => toPublicValue(store, itemRef));
      return new FormulaArray(convertedItems);
    }

    case Kind.Object: {
      const properties = store.getObject(ref);
      const convertedProps: Record<string, FormulaDataType> = {};
      for (const [key, valueRef] of properties) {
        convertedProps[key] = toPublicValue(store, valueRef);
      }
      return new FormulaObject(convertedProps);
    }

    case Kind.RegExp: {
      const { pattern, flags } = store.getRegExp(ref);
      return new FormulaRegExp(pattern, flags);
    }

    default:
      throw new Error(`Unknown kind: ${kind}`);
  }
}

/**
 * Converts a public FormulaDataType to a ValueRef in the internal store
 */
export function toInternalRef(store: FormulaValueStore, value: FormulaDataType): ValueRef {
  if (value instanceof FormulaNull) {
    return store.NULL;
  }

  if (value instanceof FormulaBoolean) {
    return value.value ? store.TRUE : store.FALSE;
  }

  if (value instanceof FormulaNumber) {
    return store.createNumber(value.value);
  }

  if (value instanceof FormulaString) {
    if (value.value === '') return store.EMPTY_STRING;
    return store.createString(value.value);
  }

  if (value instanceof FormulaDate) {
    return store.createDate(value.value.epochMilliseconds);
  }

  if (value instanceof FormulaDuration) {
    return store.createDuration(value.value.total('milliseconds'));
  }

  if (value instanceof FormulaArray) {
    const itemRefs = value.value.map(item => toInternalRef(store, item));
    return store.createArray(itemRefs);
  }

  if (value instanceof FormulaObject) {
    const propsMap = new Map<string, ValueRef>();
    for (const [key, val] of Object.entries(value.value)) {
      propsMap.set(key, toInternalRef(store, val));
    }
    return store.createObject(propsMap);
  }

  if (value instanceof FormulaRegExp) {
    return store.createRegExp(value.value.source, value.value.flags);
  }

  throw new Error(`Unknown FormulaDataType: ${value.constructor.name}`);
}
```

### 3.2 Create Internal Evaluator

**File:** `src/core/evaluator-internal.visitor.ts`

```typescript
import type { AST } from '../parser';
import type { FormulaValueStore, ValueRef, Kind } from './value-store/value-store';

/**
 * Internal evaluator that works with ValueRef instead of FormulaDataType
 */
export class InternalEvaluatorVisitor {
  readonly #store: FormulaValueStore;
  readonly #context: InternalEvaluationContext;
  readonly #hooks?: InternalEvaluationHooks;

  constructor(
    store: FormulaValueStore,
    context: InternalEvaluationContext,
    hooks?: InternalEvaluationHooks
  ) {
    this.#store = store;
    this.#context = context;
    this.#hooks = hooks;
  }

  get store(): FormulaValueStore {
    return this.#store;
  }

  get context(): InternalEvaluationContext {
    return this.#context;
  }

  evaluateNode(node: AST.AstNode): ValueRef {
    return node.accept(this);
  }

  visitLiteralNode(node: AST.ILiteralNode): ValueRef {
    if (typeof node.value === 'string') {
      return this.#store.createString(node.value);
    }

    if (typeof node.value === 'number') {
      return this.#store.createNumber(node.value);
    }

    if (typeof node.value === 'boolean') {
      return node.value ? this.#store.TRUE : this.#store.FALSE;
    }

    if (node.value === null || node.value === undefined) {
      return this.#store.NULL;
    }

    throw new Error(`Unsupported literal type ${typeof node.value}`);
  }

  visitBinaryExpressionNode(node: AST.IBinaryExpressionNode): ValueRef {
    const left = this.evaluateNode(node.left);
    const right = this.evaluateNode(node.right);

    switch (node.operator) {
      case '+': {
        // Fast path: both numbers
        if (this.#store.isNumber(left) && this.#store.isNumber(right)) {
          return this.#store.createNumber(
            this.#store.getNumber(left) + this.#store.getNumber(right)
          );
        }

        // String concatenation
        if (this.#store.isString(left) || this.#store.isString(right)) {
          return this.#store.createString(
            this.#store.toString(left) + this.#store.toString(right)
          );
        }

        throw new Error('Cannot add non-numeric values');
      }

      case '-': {
        this.#assertNumbers(left, right, node.location);
        return this.#store.createNumber(
          this.#store.getNumber(left) - this.#store.getNumber(right)
        );
      }

      case '*': {
        this.#assertNumbers(left, right, node.location);
        return this.#store.createNumber(
          this.#store.getNumber(left) * this.#store.getNumber(right)
        );
      }

      case '/': {
        this.#assertNumbers(left, right, node.location);
        const divisor = this.#store.getNumber(right);
        if (divisor === 0) {
          throw new Error('Division by zero');
        }
        return this.#store.createNumber(
          this.#store.getNumber(left) / divisor
        );
      }

      case '^': {
        this.#assertNumbers(left, right, node.location);
        return this.#store.createNumber(
          this.#store.getNumber(left) ** this.#store.getNumber(right)
        );
      }

      case '%': {
        this.#assertNumbers(left, right, node.location);
        const divisor = this.#store.getNumber(right);
        if (divisor === 0) {
          throw new Error('Division by zero (modulo)');
        }
        return this.#store.createNumber(
          this.#store.getNumber(left) % this.#store.getNumber(right)
        );
      }

      case '==': {
        return this.#equals(left, right) ? this.#store.TRUE : this.#store.FALSE;
      }

      case '!=': {
        return this.#equals(left, right) ? this.#store.FALSE : this.#store.TRUE;
      }

      case '<':
      case '<=':
      case '>':
      case '>=': {
        return this.#compare(left, right, node.operator);
      }

      case 'and':
      case '&&': {
        const leftTruthy = !this.#store.isEmpty(left);
        const rightTruthy = !this.#store.isEmpty(right);
        return (leftTruthy && rightTruthy) ? this.#store.TRUE : this.#store.FALSE;
      }

      case 'or':
      case '||': {
        const leftTruthy = !this.#store.isEmpty(left);
        const rightTruthy = !this.#store.isEmpty(right);
        return (leftTruthy || rightTruthy) ? this.#store.TRUE : this.#store.FALSE;
      }

      default:
        throw new Error(`Unsupported operator: ${node.operator}`);
    }
  }

  visitUnaryExpressionNode(node: AST.IUnaryExpressionNode): ValueRef {
    const arg = this.evaluateNode(node.arg);

    switch (node.operator) {
      case '-': {
        if (!this.#store.isNumber(arg)) {
          throw new Error('Cannot negate non-numeric value');
        }
        return this.#store.createNumber(-this.#store.getNumber(arg));
      }

      case 'not':
      case '!': {
        return this.#store.isEmpty(arg) ? this.#store.TRUE : this.#store.FALSE;
      }

      default:
        throw new Error(`Unsupported unary operator: ${node.operator}`);
    }
  }

  visitIdentifierNode(node: AST.IIdentifierNode): ValueRef {
    this.#hooks?.onIdentifier?.(node.name);

    const value = this.#context.getVariable(node.name);
    if (value === undefined) {
      throw new Error(`Variable "${node.name}" is not defined`);
    }
    return value;
  }

  visitArrayExpressionNode(node: AST.IArrayExpressionNode): ValueRef {
    const items = node.elements.map(el => this.evaluateNode(el));
    return this.#store.createArray(items);
  }

  visitConditionalExpressionNode(node: AST.IConditionalExpressionNode): ValueRef {
    const test = this.evaluateNode(node.test);
    return !this.#store.isEmpty(test)
      ? this.evaluateNode(node.consequent)
      : this.evaluateNode(node.alternate);
  }

  visitCallExpressionNode(node: AST.ICallExpressionNode): ValueRef {
    // Delegate to internal dispatcher
    return internalDispatcher.dispatch(node, this);
  }

  visitMemberExpressionNode(node: AST.IMemberExpressionNode): ValueRef {
    return this.evaluateNode(node.object);
  }

  cloneWithContext(newContext: InternalEvaluationContext): InternalEvaluatorVisitor {
    return new InternalEvaluatorVisitor(this.#store, newContext, this.#hooks);
  }

  // Private helpers

  #assertNumbers(left: ValueRef, right: ValueRef, location: AST.Location): void {
    if (!this.#store.isNumber(left) || !this.#store.isNumber(right)) {
      throw new Error('Cannot perform math on non-numeric values');
    }
  }

  #equals(left: ValueRef, right: ValueRef): boolean {
    const leftKind = this.#store.getKind(left);
    const rightKind = this.#store.getKind(right);

    if (leftKind === Kind.Null && rightKind === Kind.Null) {
      return true;
    }

    if (leftKind !== rightKind) {
      return false;
    }

    switch (leftKind) {
      case Kind.Boolean:
        return this.#store.getBoolean(left) === this.#store.getBoolean(right);
      case Kind.Number:
        return this.#store.getNumber(left) === this.#store.getNumber(right);
      case Kind.String:
        return this.#store.getString(left) === this.#store.getString(right);
      default:
        return false;
    }
  }

  #compare(left: ValueRef, right: ValueRef, op: '<' | '<=' | '>' | '>='): ValueRef {
    const leftKind = this.#store.getKind(left);
    const rightKind = this.#store.getKind(right);

    if (leftKind !== rightKind) {
      throw new Error('Cannot compare values of different types');
    }

    let result: boolean;

    if (leftKind === Kind.Number) {
      const l = this.#store.getNumber(left);
      const r = this.#store.getNumber(right);

      switch (op) {
        case '<': result = l < r; break;
        case '<=': result = l <= r; break;
        case '>': result = l > r; break;
        case '>=': result = l >= r; break;
      }
    } else if (leftKind === Kind.String) {
      const l = this.#store.getString(left);
      const r = this.#store.getString(right);

      switch (op) {
        case '<': result = l < r; break;
        case '<=': result = l <= r; break;
        case '>': result = l > r; break;
        case '>=': result = l >= r; break;
      }
    } else {
      throw new Error('Can only compare numbers and strings');
    }

    return result ? this.#store.TRUE : this.#store.FALSE;
  }
}

/**
 * Internal context using ValueRef
 */
export class InternalEvaluationContext {
  #globalProperties: Map<string, ValueRef>;
  #localScope: Map<string, ValueRef>;
  #parentContext: InternalEvaluationContext | null;

  constructor(
    globalProperties: Map<string, ValueRef> = new Map(),
    parentContext: InternalEvaluationContext | null = null
  ) {
    this.#globalProperties = globalProperties;
    this.#parentContext = parentContext;
    this.#localScope = new Map();
  }

  getVariable(name: string): ValueRef | undefined {
    if (this.#localScope.has(name)) {
      return this.#localScope.get(name);
    }

    if (this.#globalProperties.has(name)) {
      return this.#globalProperties.get(name);
    }

    if (this.#parentContext) {
      return this.#parentContext.getVariable(name);
    }

    return undefined;
  }

  setVariable(name: string, value: ValueRef): void {
    this.#localScope.set(name, value);
  }

  createNestedContext(variables: Record<string, ValueRef>): InternalEvaluationContext {
    const nested = new InternalEvaluationContext(this.#globalProperties, this);
    for (const [name, value] of Object.entries(variables)) {
      nested.setVariable(name, value);
    }
    return nested;
  }
}

interface InternalEvaluationHooks {
  onIdentifier?: (name: string) => void;
}
```

### 3.3 Migrate Expression.evaluate()

**File:** `src/core/expression.ts` (modified)

```typescript
import { FormulaValueStore } from './value-store/value-store';
import { toPublicValue, toInternalRef } from './value-store/converters';
import { InternalEvaluatorVisitor, InternalEvaluationContext } from './evaluator-internal.visitor';

export class Expression {
  // ... existing code ...

  evaluate(options: EvaluateOptions = {}): EvaluateResult {
    const ast = this.parse();

    // Create internal store
    const store = new FormulaValueStore();

    // Convert context to internal refs
    const globalProperties = new Map<string, ValueRef>();

    if (options.context) {
      const entries = options.context instanceof Map
        ? options.context.entries()
        : Object.entries(options.context);

      for (const [name, value] of entries) {
        globalProperties.set(name, toInternalRef(store, value));
      }
    }

    const context = new InternalEvaluationContext(globalProperties);
    const dependencies = new Set<string>();

    // Create internal visitor
    const visitor = new InternalEvaluatorVisitor(store, context, {
      onIdentifier: (id) => dependencies.add(id),
    });

    // Evaluate using internal visitor
    const resultRef = visitor.evaluateNode(ast);

    // Convert result back to public API
    const result = toPublicValue(store, resultRef);

    return {
      result,
      dependencies,
    };
  }
}
```

### 3.4 Migrate Array Methods

**File:** `src/core/routines/internal-handlers/array-methods.ts`

```typescript
import type { FormulaValueStore, ValueRef } from '../../value-store/value-store';
import type { InternalEvaluatorVisitor } from '../../evaluator-internal.visitor';

export function handleArrayMap(
  store: FormulaValueStore,
  instanceRef: ValueRef,
  callbackNode: AST.AstNode,
  visitor: InternalEvaluatorVisitor
): ValueRef {
  const items = store.getArray(instanceRef);

  const results = items.map((itemRef, index) => {
    // Create nested context with 'current' and 'index'
    const nestedContext = visitor.context.createNestedContext({
      current: itemRef,
      index: store.createNumber(index),  // This gets cached for small ints!
    });

    const callbackVisitor = visitor.cloneWithContext(nestedContext);
    return callbackVisitor.evaluateNode(callbackNode);
  });

  return store.createArray(results);
}

export function handleArrayFilter(
  store: FormulaValueStore,
  instanceRef: ValueRef,
  callbackNode: AST.AstNode,
  visitor: InternalEvaluatorVisitor
): ValueRef {
  const items = store.getArray(instanceRef);

  const results: ValueRef[] = [];

  for (let i = 0; i < items.length; i++) {
    const itemRef = items[i];

    const nestedContext = visitor.context.createNestedContext({
      current: itemRef,
      index: store.createNumber(i),
    });

    const callbackVisitor = visitor.cloneWithContext(nestedContext);
    const predicateResult = callbackVisitor.evaluateNode(callbackNode);

    // Check if truthy
    if (!store.isEmpty(predicateResult)) {
      results.push(itemRef);
    }
  }

  return store.createArray(results);
}

export function handleArrayLength(
  store: FormulaValueStore,
  instanceRef: ValueRef
): ValueRef {
  const items = store.getArray(instanceRef);
  return store.createNumber(items.length);
}

export function handleArrayJoin(
  store: FormulaValueStore,
  instanceRef: ValueRef,
  separatorRef: ValueRef | undefined
): ValueRef {
  const items = store.getArray(instanceRef);
  const separator = separatorRef ? store.getString(separatorRef) : '';

  const strings = items.map(ref => store.toString(ref));
  return store.createString(strings.join(separator));
}
```

### 3.5 Tasks Checklist for Phase 2

- [ ] Create `src/core/value-store/converters.ts`
- [ ] Implement `toPublicValue()` function
- [ ] Implement `toInternalRef()` function
- [ ] Create `src/core/evaluator-internal.visitor.ts`
- [ ] Create `InternalEvaluationContext` class
- [ ] Implement all visit methods in InternalEvaluatorVisitor
- [ ] Migrate `Expression.evaluate()` to use internal evaluator
- [ ] Create internal dispatcher for function/method calls
- [ ] Migrate array methods to internal handlers
- [ ] Migrate string methods to internal handlers
- [ ] Migrate number methods to internal handlers
- [ ] Migrate all other methods
- [ ] Update tests to ensure backward compatibility
- [ ] Benchmark: measure performance improvement

---

## 4. Phase 3: Runtime Integration (2 weeks)

### 4.1 Runtime Store Strategy

The runtime needs to store formula results. We have two options:

**Option A: Store as FormulaDataType (simpler)**
```typescript
class FormulaRuntime {
  private results: Map<string, FormulaDataType> = new Map();

  // Results are converted at storage time
  setResult(id: string, result: FormulaDataType): void {
    this.results.set(id, result);
  }
}
```

**Option B: Store as ValueRef with persistent store (faster)**
```typescript
class FormulaRuntime {
  private store: FormulaValueStore;
  private results: Map<string, ValueRef> = new Map();

  // Results stay as refs, converted only when needed
  setResult(id: string, ref: ValueRef): void {
    this.results.set(id, ref);
  }

  getResult(id: string): FormulaDataType {
    const ref = this.results.get(id);
    return ref ? toPublicValue(this.store, ref) : undefined;
  }
}
```

**Recommendation:** Start with Option A, migrate to Option B later if needed.

### 4.2 Executor Integration

**File:** `src/runtime/executor/executor.ts` (modified)

```typescript
export class FormulaExecutor {
  // ... existing code ...

  execute(formulaId: string): FormulaDataType {
    const formula = this.getFormula(formulaId);
    const expression = new Expression(formula.source);

    // Context preparation remains the same
    const context = this.prepareContext(formulaId);

    // evaluate() now uses SoA internally but returns FormulaDataType
    const { result } = expression.evaluate({ context });

    return result;
  }
}
```

### 4.3 Batch Evaluation with Arena

For batch evaluation, we can reuse a single store:

```typescript
class BatchEvaluator {
  private store: FormulaValueStore;

  constructor() {
    this.store = new FormulaValueStore(16384); // Larger initial capacity
  }

  evaluateBatch(formulas: Expression[], contexts: EvaluateOptions[]): FormulaDataType[] {
    const results: FormulaDataType[] = [];

    for (let i = 0; i < formulas.length; i++) {
      // Mark position in store
      const mark = this.store.mark();

      try {
        const resultRef = this.evaluateInternal(formulas[i], contexts[i]);
        // Convert before releasing
        results.push(toPublicValue(this.store, resultRef));
      } finally {
        // Release memory back to mark
        this.store.releaseTo(mark);
      }
    }

    return results;
  }
}
```

### 4.4 Tasks Checklist for Phase 3

- [ ] Decide on runtime store strategy (Option A or B)
- [ ] Update FormulaExecutor to work with new evaluate()
- [ ] Update AsyncFormulaExecutor
- [ ] Implement BatchEvaluator with arena allocation
- [ ] Update dependency graph to work with internal refs (if using Option B)
- [ ] Update recalculation queue
- [ ] Integration tests with runtime
- [ ] Performance benchmarks for batch scenarios

---

## 5. Phase 4: Optimization (2 weeks)

### 5.1 Number Caching

```typescript
class FormulaValueStore {
  // Cache for frequently used integers
  private integerCache: Map<number, ValueRef> = new Map();

  createNumber(value: number): ValueRef {
    // Cache small integers
    if (Number.isInteger(value) && value >= -128 && value <= 127) {
      let cached = this.integerCache.get(value);
      if (!cached) {
        cached = this.allocateNumber(value);
        this.integerCache.set(value, cached);
      }
      return cached;
    }

    return this.allocateNumber(value);
  }
}
```

### 5.2 String Interning Optimization

```typescript
class FormulaValueStore {
  private stringIntern: Map<string, number>;

  constructor() {
    // Pre-intern common strings
    this.internString('');
    this.internString('true');
    this.internString('false');
    this.internString('null');
    this.internString('undefined');
  }

  // Consider using a trie for prefix-based lookup
  // or a bloom filter for quick negative lookups
}
```

### 5.3 SIMD Operations (Future)

For numeric array operations:

```typescript
// Using WASM SIMD for bulk operations
async function sumNumbers(store: FormulaValueStore, arrayRef: ValueRef): Promise<number> {
  const items = store.getArray(arrayRef);

  // Gather all numbers into a Float64Array
  const numbers = new Float64Array(items.length);
  for (let i = 0; i < items.length; i++) {
    numbers[i] = store.getNumber(items[i]);
  }

  // Use SIMD-optimized sum (via WASM or native)
  return simdSum(numbers);
}
```

### 5.4 Tasks Checklist for Phase 4

- [ ] Implement number caching for small integers
- [ ] Optimize string interning
- [ ] Profile and identify remaining bottlenecks
- [ ] Implement specialized fast paths for common operations
- [ ] Consider WASM SIMD for bulk numeric operations
- [ ] Memory profiling and optimization
- [ ] Final performance benchmarks

---

## 6. Phase 5: Stabilization (1 week)

### 6.1 Documentation

- [ ] Update API documentation
- [ ] Add internal architecture documentation
- [ ] Document performance characteristics
- [ ] Add migration guide for any API changes

### 6.2 Testing

- [ ] 100% test coverage for new code
- [ ] Regression tests for all existing functionality
- [ ] Stress tests for memory management
- [ ] Fuzz testing for edge cases

### 6.3 Monitoring

- [ ] Add performance metrics collection
- [ ] Memory usage monitoring
- [ ] Error tracking for new code paths

---

## 7. Risk Mitigation

### 7.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Memory leaks in arena allocator | Medium | High | Extensive testing, memory profiling |
| Type safety loss | Medium | Medium | Careful TypeScript typing, runtime checks |
| Performance regression in edge cases | Low | Medium | Comprehensive benchmarking |
| Incompatibility with existing routines | Medium | High | Gradual migration, adapter layer |

### 7.2 Mitigation Strategies

1. **Feature Flags:**
```typescript
const USE_SOA = process.env.FORMULA_ENGINE_SOA === 'true';

export function evaluate(formula: string, options?: EvaluateOptions) {
  if (USE_SOA) {
    return evaluateWithSoA(formula, options);
  }
  return evaluateOriginal(formula, options);
}
```

2. **Gradual Rollout:**
   - Week 1-2: 1% of traffic
   - Week 3-4: 10% of traffic
   - Week 5+: 100% if metrics are good

3. **Monitoring:**
   - Track evaluation time percentiles (p50, p95, p99)
   - Monitor memory usage
   - Alert on error rate increase

---

## 8. Rollback Strategy

### 8.1 Code Organization

Keep original implementation alongside new:

```
src/core/
├── evaluator.visitor.ts           # Original (keep)
├── evaluator-internal.visitor.ts  # New SoA version
├── expression.ts                  # Switch between versions
└── value-store/                   # New SoA components
```

### 8.2 Quick Rollback

```typescript
// In expression.ts
const USE_INTERNAL_EVALUATOR = true; // Set to false to rollback

evaluate(options: EvaluateOptions = {}): EvaluateResult {
  if (USE_INTERNAL_EVALUATOR) {
    return this.evaluateInternal(options);
  }
  return this.evaluateOriginal(options);
}
```

### 8.3 Data Migration

Since public API doesn't change, no data migration needed.

---

## 9. Success Metrics

### 9.1 Performance Targets

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| 1000 simple formulas | ~50ms | <10ms | Benchmark suite |
| 10K numbers creation | ~5ms | <1ms | Micro-benchmark |
| Memory per 1K formulas | ~2MB | <500KB | Heap snapshot |
| GC pause time | ~10ms | <2ms | Performance API |
| map() on 1K items | ~15ms | <3ms | Benchmark suite |

### 9.2 Quality Targets

| Metric | Target |
|--------|--------|
| Test coverage | >95% |
| Zero regressions | All existing tests pass |
| No new memory leaks | Stable memory over time |
| API compatibility | 100% backward compatible |

### 9.3 Measurement Plan

```typescript
// Benchmark configuration
const benchmarks = [
  {
    name: 'Simple arithmetic',
    formulas: Array(1000).fill('1 + 2 * 3'),
    target: 10, // ms
  },
  {
    name: 'Array map',
    formula: 'items.map(current * 2)',
    context: { items: FormulaArray.from(Array(1000).fill(42)) },
    target: 3, // ms
  },
  {
    name: 'Complex nested',
    formula: 'users.filter(current.age() > 30).map(current.salary() * 1.1)',
    context: { users: generateUsers(1000) },
    target: 20, // ms
  },
];
```

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Foundation | 2 weeks | FormulaValueStore, basic operations |
| Phase 2: Core Migration | 3 weeks | InternalEvaluator, converters, methods |
| Phase 3: Runtime Integration | 2 weeks | Executor, batch evaluation |
| Phase 4: Optimization | 2 weeks | Caching, fast paths, profiling |
| Phase 5: Stabilization | 1 week | Docs, testing, monitoring |
| **Total** | **10 weeks** | Full SoA migration |

---

## Appendix A: File Structure

```
src/core/
├── value-store/
│   ├── value-store.ts           # Main store implementation
│   ├── converters.ts            # Public ↔ Internal converters
│   ├── kind.ts                  # Kind enum
│   └── __tests__/
│       ├── value-store.test.ts
│       └── converters.test.ts
├── evaluator-internal.visitor.ts
├── context-internal.ts
├── routines/
│   ├── internal-dispatcher.ts
│   └── internal-handlers/
│       ├── array-methods.ts
│       ├── string-methods.ts
│       ├── number-methods.ts
│       └── ...
└── ...existing files...
```

---

## Appendix B: TypedArray Memory Layout

```
FormulaValueStore Memory Layout (1024 initial capacity):

kinds:          Uint8Array(1024)     =    1 KB
booleans:       Uint8Array(1024)     =    1 KB
numbers:        Float64Array(1024)   =    8 KB
stringIndices:  Uint32Array(1024)    =    4 KB
timestamps:     Float64Array(1024)   =    8 KB
durations:      Float64Array(1024)   =    8 KB
complexIndices: Uint32Array(1024)    =    4 KB
─────────────────────────────────────────────────
Total (base):                        =   34 KB

vs AoS equivalent (1024 objects):
Each FormulaDataType ~64-128 bytes   = 64-128 KB

Memory savings: 50-75%
```

---

## Appendix C: References

- [V8 Hidden Classes](https://v8.dev/blog/fast-properties)
- [Data-Oriented Design](https://www.dataorienteddesign.com/dodbook/)
- [TypedArray Performance](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray)
- [Arena Allocation](https://en.wikipedia.org/wiki/Region-based_memory_management)
