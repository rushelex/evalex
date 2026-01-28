import { RecalculationQueue } from '../recalculation-queue';

describe('RecalculationQueue', () => {
  let queue: RecalculationQueue;

  beforeEach(() => {
    queue = new RecalculationQueue();
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
