import { fc, it } from '@fast-check/vitest';

import { RecalculationQueue } from '../recalculation-queue';

type QueueOperation
  = | { readonly type: 'enqueue'; readonly id: string }
    | { readonly type: 'remove'; readonly id: string }
    | { readonly type: 'dequeue' };

// A few ids, so that random operations keep enqueuing and removing the same ones.
const id = fc.constantFrom('A', 'B', 'C', 'D');

const queueOperation: fc.Arbitrary<QueueOperation> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ type: fc.constant('enqueue' as const), id }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('remove' as const), id }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constant('dequeue' as const) }) },
);

describe('RecalculationQueue', () => {
  let queue: RecalculationQueue;

  beforeEach(() => {
    queue = new RecalculationQueue(() => 0);
  });

  it.prop([fc.array(queueOperation, { maxLength: 30 })])('should hand out each waiting id once, in the order it first arrived, after any sequence of changes', (operations) => {
    const tested = new RecalculationQueue(() => 0);
    const waiting: string[] = [];

    operations.forEach((operation, step) => {
      let expected: string | undefined;
      let actual: string | undefined;

      switch (operation.type) {
        case 'enqueue':
          if (!waiting.includes(operation.id)) {
            waiting.push(operation.id);
          }
          tested.enqueue(operation.id);
          break;
        case 'remove':
          waiting.splice(0, waiting.length, ...waiting.filter((waitingId) => waitingId !== operation.id));
          tested.remove(operation.id);
          break;
        case 'dequeue':
          expected = waiting.shift();
          actual = tested.dequeue();
          break;
      }

      expect({ step, dequeued: actual, size: tested.size() }).toEqual({ step, dequeued: expected, size: waiting.length });
    });
  });

  it.prop([fc.array(queueOperation, { maxLength: 30 }), fc.tuple(fc.nat(3), fc.nat(3), fc.nat(3), fc.nat(3))])('should hand out the shallowest waiting id first, and ids of one depth in the order they arrived', (operations, [a, b, c, d]) => {
    const depths = new Map([['A', a], ['B', b], ['C', c], ['D', d]]);
    const depthOf = (waitingId: string): number => depths.get(waitingId) ?? 0;
    const tested = new RecalculationQueue(depthOf);
    const waiting: string[] = [];

    operations.forEach((operation, step) => {
      let expected: string | undefined;
      let actual: string | undefined;

      switch (operation.type) {
        case 'enqueue':
          if (!waiting.includes(operation.id)) {
            waiting.push(operation.id);
          }
          tested.enqueue(operation.id);
          break;
        case 'remove':
          waiting.splice(0, waiting.length, ...waiting.filter((waitingId) => waitingId !== operation.id));
          tested.remove(operation.id);
          break;
        case 'dequeue': {
          const shallowest = Math.min(...waiting.map((waitingId) => depthOf(waitingId)));
          expected = waiting.find((waitingId) => depthOf(waitingId) === shallowest);
          waiting.splice(0, waiting.length, ...waiting.filter((waitingId) => waitingId !== expected));
          actual = tested.dequeue();
          break;
        }
      }

      expect({ step, dequeued: actual, size: tested.size() }).toEqual({ step, dequeued: expected, size: waiting.length });
    });
  });

  it('should keep the depth an id arrived with when it is enqueued again after its depth changed', () => {
    const depths = new Map([['A', 0], ['B', 1]]);
    const tested = new RecalculationQueue((waitingId) => depths.get(waitingId) ?? 0);
    tested.enqueue('A');
    tested.enqueue('B');
    depths.set('A', 2);
    tested.enqueue('A');

    expect([tested.dequeue(), tested.dequeue(), tested.dequeue(), tested.size()]).toEqual(['A', 'B', undefined, 0]);
  });

  it('should hand out an id removed and enqueued again in the order of its new arrival', () => {
    queue.enqueue('n1');
    queue.enqueue('n2');
    queue.remove('n1');
    queue.enqueue('n1');

    expect([queue.dequeue(), queue.dequeue(), queue.dequeue()]).toEqual(['n2', 'n1', undefined]);
  });

  it('should add and return nodeIds in insertion order', () => {
    queue.enqueue('n1');
    queue.enqueue('n2');
    queue.enqueue('n3');
    expect(queue.size()).toBe(3);
    expect(queue.dequeue()).toBe('n1');
    expect(queue.dequeue()).toBe('n2');
    expect(queue.dequeue()).toBe('n3');
    expect(queue.dequeue()).toBeUndefined();
    expect(queue.size()).toBe(0);
  });

  it('should not add duplicates', () => {
    queue.enqueue('n1');
    queue.enqueue('n1');
    expect(queue.size()).toBe(1);
    expect(queue.dequeue()).toBe('n1');
    expect(queue.dequeue()).toBeUndefined();
  });

  it('should remove nodeId', () => {
    queue.enqueue('n1');
    queue.enqueue('n2');
    queue.remove('n1');
    expect(queue.size()).toBe(1);
    expect(queue.dequeue()).toBe('n2');
    expect(queue.dequeue()).toBeUndefined();
  });

  it('should be empty after removing all nodeIds', () => {
    queue.enqueue('n1');
    queue.enqueue('n2');
    queue.remove('n1');
    queue.remove('n2');
    expect(queue.size()).toBe(0);
    expect(queue.dequeue()).toBeUndefined();
  });
});
