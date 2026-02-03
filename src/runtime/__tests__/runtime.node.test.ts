import type { Expression, FormulaDataType } from '../../core';
import type { FormulaNode } from '../types';

import LeakDetector from 'jest-leak-detector';

import { FormulaNumber } from '../../core';
import { setup } from './runtime.test';

// Minimal node model for formula tests
interface Node extends FormulaNode {
  value: FormulaDataType;
  expression?: Expression;
  activeDeps?: Set<string>;
}

describe('FormulaRuntime - Garbage Collection Cleanup', () => {
  it('should clean graph and registry after properties are GCed', async () => {
    const { registry, runtime } = setup();

    let node: Node | undefined = { id: 'N1', value: new FormulaNumber(1) };
    registry.set(node.id, node);
    runtime.register(node.id, node);

    const detector = new LeakDetector(node);

    runtime.unregister(node);
    registry.delete(node.id);

    node = undefined;

    await runtime.waitForProcessing();

    await expect(detector.isLeaking()).resolves.toBe(false);
  });
});
