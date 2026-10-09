import type { AST } from '../../../parser';
import type { FormulaEvaluatorVisitor } from '../../evaluator.visitor';

import { FormulaDataType, FormulaString, Kind } from '../../data-types';
import { RoutinesRegistry } from '../registry';

class BaseDataType extends FormulaDataType<number> {
  static readonly kind = Kind.Number;

  constructor(value: number = 0) {
    super(Kind.Number, value, 'Number');
  }

  isEmpty(): boolean {
    return this.value === 0;
  }

  toString(): string {
    return String(this.value);
  }
}

class DerivedDataType extends BaseDataType {}

class OtherDataType extends FormulaDataType<string> {
  static readonly kind = Kind.String;

  constructor(value: string = '') {
    super(Kind.String, value, 'Text');
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }

  toString(): string {
    return this.value;
  }
}

const mockCallExpressionNode = { args: [] } as unknown as AST.ICallExpressionNode;

const mockVisitor = { evaluateNode: () => undefined } as unknown as FormulaEvaluatorVisitor;

const mockLocation: AST.Location = { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } };

describe('RoutinesRegistry', () => {
  it('registerFunction/getFunction: should work', () => {
    const registry = new RoutinesRegistry();

    registry.registerFunction('hello', {
      description: 'hello func',
      examples: [],
      handler: () => new FormulaString('world'),
    });

    const routine = registry.getFunction('hello');
    expect(routine).toBeDefined();
    const result = routine!.execute({
      instance: undefined,
      node: mockCallExpressionNode,
      visitor: mockVisitor,
      location: mockLocation,
    });
    expect(result).toBeFormulaDataType(FormulaString, 'world');
  });

  it('registerMethod: should attach to ctor and inherit to derived', () => {
    const registry = new RoutinesRegistry();

    registry.registerMethod(BaseDataType, 'id', {
      description: 'base id',
      examples: [],
      handler: ({ instance }) => new FormulaString(`base:${(instance).value}`),
    });

    const baseMethod = registry.getMethod(BaseDataType, 'id');
    expect(baseMethod).toBeDefined();

    const derivedMethod = registry.getMethod(DerivedDataType, 'id');
    expect(derivedMethod).toBeDefined();

    // ensure derived sees base method
    const d = new DerivedDataType(5);
    const result = derivedMethod!.execute({
      instance: d,
      node: mockCallExpressionNode,
      visitor: mockVisitor,
      location: mockLocation,
    });
    expect(result).toBeFormulaDataType(FormulaString, 'base:5');
  });

  it('override in derived: should take precedence over base', () => {
    const registry = new RoutinesRegistry();

    registry.registerMethod(BaseDataType, 'foo', {
      description: 'base foo',
      examples: [],
      handler: () => new FormulaString('base'),
    });

    registry.registerMethod(DerivedDataType, 'foo', {
      description: 'derived foo',
      examples: [],
      handler: () => new FormulaString('derived'),
    });

    const method = registry.getMethod(DerivedDataType, 'foo');
    const res = method!.execute({
      instance: new DerivedDataType(),
      node: mockCallExpressionNode,
      visitor: mockVisitor,
      location: mockLocation,
    });
    expect(res).toBeFormulaDataType(FormulaString, 'derived');
  });

  it('finalize: should cache resolved maps and keep identity for known ctors', () => {
    const registry = new RoutinesRegistry();
    registry.registerMethod(BaseDataType, 'm', {
      description: 'm',
      examples: [],
      handler: () => new FormulaString('m'),
    });

    const beforeFinalizeFirst = registry.getMethods(BaseDataType);
    const beforeFinalizeSecond = registry.getMethods(BaseDataType);
    // pre-finalize not guaranteed to be identity-cached
    expect(beforeFinalizeFirst).toBeDefined();
    expect(beforeFinalizeSecond).toBeDefined();

    registry.finalize();

    const afterFinalizeFirst = registry.getMethods(BaseDataType);
    const afterFinalizeSecond = registry.getMethods(BaseDataType);
    expect(afterFinalizeFirst).toBe(afterFinalizeSecond);
  });

  it('getMethods: should opportunistically cache unknown ctor after finalize', () => {
    const registry = new RoutinesRegistry();
    registry.finalize();

    const first = registry.getMethods(OtherDataType);
    const second = registry.getMethods(OtherDataType);
    expect(first).toBe(second);
  });

  it('registerMethod: after finalize should invalidate cache', () => {
    const registry = new RoutinesRegistry();
    registry.registerMethod(BaseDataType, 'm', { description: 'm', examples: [], handler: () => new FormulaString('m') });
    registry.finalize();

    const before = registry.getMethods(BaseDataType);

    registry.registerMethod(BaseDataType, 'n', { description: 'n', examples: [], handler: () => new FormulaString('n') });

    const after = registry.getMethods(BaseDataType);

    // After invalidation, map instance may change; ensure new method is present
    expect(after).not.toBe(before);
    expect(after.has('n')).toBe(true);
  });
});
