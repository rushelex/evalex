import type { FormulaDataType } from '../../core';

import type { AsyncRunner, Executor } from '../executor';
import type { FormulaNode, NodeAdapter } from '../types';

import { fc, it } from '@fast-check/vitest';

import { Expression, FormulaArray, FormulaNull, FormulaNumber } from '../../core';
import { AsyncExecutor, SyncExecutor } from '../executor';
import { FormulaRuntime } from '../runtime';
import { ImmediateScheduler } from '../scheduler';

interface Node extends FormulaNode {
  value: FormulaDataType;
  expression?: Expression;
  error?: Error;
}

describe('FormulaRuntime skipping work with a known outcome', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not recalculate dependents when an update repeats the value they hold', async () => {
    const sheet = createSheet();
    sheet.add('a', 1);
    sheet.add('double', 'a * 2');
    await sheet.calculateAll();

    sheet.calculated.length = 0;
    await sheet.update('a', 1);

    expect(sheet.calculated).toEqual([]);
    expect(sheet.value('double')).toEqual(new FormulaNumber(2));
  });

  it('should recalculate dependents when an update brings a new value', async () => {
    const sheet = createSheet();
    sheet.add('a', 1);
    sheet.add('double', 'a * 2');
    await sheet.calculateAll();

    sheet.calculated.length = 0;
    await sheet.update('a', 5);

    expect(sheet.calculated).toEqual(['double']);
    expect(sheet.value('double')).toEqual(new FormulaNumber(10));
  });

  it('should not recalculate a requeued formula whose inputs did not change', async () => {
    const sheet = createSheet();
    sheet.add('a', 1);
    sheet.add('double', 'a * 2');
    await sheet.calculateAll();

    sheet.calculated.length = 0;
    await sheet.calculateAll();

    expect(sheet.calculated).toEqual([]);
  });

  it('should not recalculate dependents of a formula whose result did not change', async () => {
    const sheet = createSheet();
    sheet.add('x', 1);
    sheet.add('zero', 'x * 0');
    sheet.add('next', 'zero + 1');
    await sheet.calculateAll();

    sheet.calculated.length = 0;
    await sheet.update('x', 2);

    expect(sheet.calculated).toEqual(['zero']);
    expect(sheet.value('next')).toEqual(new FormulaNumber(1));
  });

  it('should recalculate a formula calling a volatile routine when an update repeats the value', async () => {
    const sheet = createSheet();
    sheet.add('a', 1);
    sheet.add('stamp', '[a, now()]');
    await sheet.calculateAll();

    sheet.calculated.length = 0;
    await sheet.update('a', 1);

    expect(sheet.calculated).toEqual(['stamp']);
  });

  it('should refresh formulas reading a volatile one when the cascade is cut off before it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const sheet = createSheet();
    sheet.add('x', 1);
    sheet.add('zero', 'x * 0');
    sheet.add('stamp', '[zero, now()]');
    sheet.add('copy', '[stamp]');
    await sheet.calculateAll();

    vi.setSystemTime(new Date('2026-01-01T00:00:05Z'));
    sheet.calculated.length = 0;
    await sheet.update('x', 2);

    expect(sheet.calculated).toEqual(['zero', 'stamp', 'copy']);
    expect(sheet.value('copy').toString()).toContain('00:00:05');
  });

  it('should recalculate a dependent that read another value since the last update', async () => {
    const sheet = createSheet();
    sheet.add('a', 1);
    sheet.add('b', 1);
    sheet.add('sum', 'a + b');
    await sheet.calculateAll();
    await sheet.update('a', 1);

    // `a` changes without an update, and `sum` reads it while recalculating for `b`
    sheet.set('a', 5);
    await sheet.update('b', 2);
    await sheet.update('a', 1);

    expect(sheet.value('sum')).toEqual(new FormulaNumber(3));
  });

  it('should retry a failed dependent when an update repeats the value', async () => {
    let failNext = false;
    const runner: AsyncRunner = async (job) => {
      if (failNext) {
        failNext = false;
        throw new Error('Formula execution timed out');
      }

      return job();
    };

    const sheet = createSheet(new AsyncExecutor({ runner }));
    sheet.add('a', 1);
    sheet.add('double', 'a * 2');
    await sheet.calculateAll();

    failNext = true;
    await sheet.update('a', 3);
    expect(sheet.node('double').error?.message).toBe('Formula execution timed out');

    await sheet.update('a', 3);

    expect(sheet.node('double').error).toBeUndefined();
    expect(sheet.value('double')).toEqual(new FormulaNumber(6));
  });

  it('should treat the same list instance as unchanged and a new one as changed', async () => {
    const list = FormulaArray.from([1, 2]);
    const sheet = createSheet();
    sheet.add('items', list);
    sheet.add('count', 'items.length()');
    await sheet.calculateAll();

    sheet.calculated.length = 0;
    await sheet.update('items', list);
    expect(sheet.calculated).toEqual([]);

    await sheet.update('items', FormulaArray.from([1, 2]));
    expect(sheet.calculated).toEqual(['count']);
  });
});

// Each formula reads one to three earlier nodes by index, counted over the sources `a` and `b` and the formulas before it.
const acyclicSheet = fc.array(fc.array(fc.nat(), { minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 8 });

describe('FormulaRuntime evaluation order', () => {
  it.prop([acyclicSheet, fc.constantFrom('sync', 'async'), fc.integer({ min: 2, max: 9 })])('should evaluate each affected formula once, after every formula it reads, whatever the shape of the graph', async (reads, executorKind, newValue) => {
    const sheet = createSheet(executorKind === 'sync' ? new SyncExecutor() : new AsyncExecutor());
    const ids = ['a', 'b'];
    const readIds = new Map<string, string[]>();
    sheet.add('a', 1);
    sheet.add('b', 1);

    reads.forEach((indices, position) => {
      const id = `f${position}`;
      const read = [...new Set(indices.map((index) => ids[index % ids.length]))];
      readIds.set(id, read);
      sheet.add(id, `${read.join(' + ')} + 1`);
      ids.push(id);
    });

    await sheet.calculateAll();
    sheet.calculated.length = 0;
    await sheet.update('a', newValue);

    const orderProblems = sheet.calculated.flatMap((id, position) => [
      ...(sheet.calculated.indexOf(id) === position ? [] : [`${id} evaluated again`]),
      ...(readIds.get(id) ?? [])
        .filter((read) => sheet.calculated.lastIndexOf(read) > position)
        .map((read) => `${id} evaluated before ${read}`),
    ]);

    expect(orderProblems).toEqual([]);
  });

  it('should hand the host only the final value of a formula reading a source and a deeper formula', async () => {
    const sheet = createSheet();
    const received: FormulaDataType[] = [];
    sheet.add('a', 1);
    sheet.add('b', 'a + 1');
    sheet.add('c', 'b + 1');
    sheet.add('d', 'a + c');
    await sheet.calculateAll();

    sheet.onCalculate('d', (value) => received.push(value));
    await sheet.update('a', 7);

    expect(received).toEqual([new FormulaNumber(16)]);
  });
});

function createSheet(executor: Executor = new SyncExecutor()) {
  const registry = new Map<string, Node>();
  const calculated: string[] = [];
  const listeners = new Map<string, (value: FormulaDataType) => void>();

  const adapter: NodeAdapter<Node> = {
    shouldProcess: (node) => !!node.expression,
    toFormulaDataType: (node) => node.value,
    toExpression: (node) => node.expression ?? null,
    onCalculate: (node, value) => {
      calculated.push(node.id);
      listeners.get(node.id)?.(value);
      node.value = value;
      node.error = undefined;
    },
    onError: (node, error) => {
      node.value = new FormulaNull();
      node.error = error;
    },
  };

  const runtime = new FormulaRuntime<Node>({
    executor,
    scheduler: new ImmediateScheduler(),
    adapter,
    nodeProvider: (id) => registry.get(id),
  });

  const toValue = (value: number | FormulaDataType): FormulaDataType => typeof value === 'number' ? new FormulaNumber(value) : value;

  const node = (id: string): Node => {
    const found = registry.get(id);
    if (!found) {
      throw new Error(`Unknown node "${id}"`);
    }

    return found;
  };

  return {
    calculated,
    node,
    onCalculate: (id: string, listener: (value: FormulaDataType) => void): void => {
      listeners.set(id, listener);
    },
    value: (id: string): FormulaDataType => node(id).value,
    add: (id: string, content: number | string | FormulaDataType): void => {
      registry.set(id, typeof content === 'string'
        ? { id, value: new FormulaNull(), expression: new Expression(content) }
        : { id, value: toValue(content) });
    },
    // Changes a value without telling the runtime
    set: (id: string, value: number): void => {
      node(id).value = new FormulaNumber(value);
    },
    update: async (id: string, value: number | FormulaDataType): Promise<void> => {
      node(id).value = toValue(value);
      runtime.enqueueDependents(id);
      await runtime.waitForProcessing();
    },
    calculateAll: async (): Promise<void> => {
      for (const [id, entry] of registry) {
        if (entry.expression) {
          runtime.enqueue(id);
        }
      }

      await runtime.waitForProcessing();
    },
  };
}
