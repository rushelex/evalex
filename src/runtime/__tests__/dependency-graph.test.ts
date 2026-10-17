import { fc, it } from '@fast-check/vitest';

import { Errors } from '../../core/errors';
import { DependencyGraph } from '../dependency-graph';

// A few names, so that random operations keep hitting the same nodes and build real chains and cycles.
const NODES = ['A', 'B', 'C', 'D', 'E'];

type GraphOperation
  = | { readonly type: 'add'; readonly node: string; readonly dependsOn: string }
    | { readonly type: 'remove'; readonly node: string; readonly dependsOn: string }
    | { readonly type: 'replace'; readonly node: string; readonly dependencies: readonly string[] }
    | { readonly type: 'removeAll'; readonly node: string };

interface GraphState {
  readonly nodes: Readonly<Record<string, { readonly dependencies: readonly string[]; readonly dependents: readonly string[]; readonly depth: number }>>;
  readonly dependenciesSize: number;
  readonly dependentsSize: number;
}

const node = fc.constantFrom(...NODES);

const graphOperation: fc.Arbitrary<GraphOperation> = fc.oneof(
  { weight: 4, arbitrary: fc.record({ type: fc.constant('add' as const), node, dependsOn: node }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constant('remove' as const), node, dependsOn: node }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constant('replace' as const), node, dependencies: fc.uniqueArray(node, { maxLength: 3 }) }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('removeAll' as const), node }) },
);

/** Reference graph kept as plain edge lists, against which the real graph is checked after every operation. */
class GraphModel {
  readonly #edges = new Map<string, ReadonlySet<string>>();

  /** Applies the operation and returns whether it is refused because it would close a cycle. */
  apply(operation: GraphOperation): boolean {
    const { node: changed } = operation;
    const current = this.#dependencies(changed);

    switch (operation.type) {
      case 'add':
        return this.#replace(changed, new Set([...current, operation.dependsOn]));
      case 'remove':
        this.#edges.set(changed, new Set([...current].filter((dependency) => dependency !== operation.dependsOn)));
        return false;
      case 'replace':
        return this.#replace(changed, new Set(operation.dependencies));
      case 'removeAll':
        this.#edges.delete(changed);
        this.#edges.forEach((dependencies, from) => this.#edges.set(from, new Set([...dependencies].filter((dependency) => dependency !== changed))));
        return false;
    }
  }

  state(): GraphState {
    const nodes = Object.fromEntries(NODES.map((name) => [name, {
      dependencies: [...this.#dependencies(name)].sort(),
      dependents: NODES.filter((other) => this.#dependencies(other).has(name)),
      depth: this.#depth(name),
    }]));
    const entries = Object.values(nodes);

    return {
      nodes,
      dependenciesSize: entries.filter(({ dependencies }) => dependencies.length > 0).length,
      dependentsSize: entries.filter(({ dependents }) => dependents.length > 0).length,
    };
  }

  #replace(changed: string, dependencies: ReadonlySet<string>): boolean {
    const closesCycle = [...dependencies].some((dependency) => this.#reaches(dependency, changed));

    if (!closesCycle) {
      this.#edges.set(changed, dependencies);
    }

    return closesCycle;
  }

  #dependencies(name: string): ReadonlySet<string> {
    return this.#edges.get(name) ?? new Set();
  }

  #reaches(from: string, to: string): boolean {
    return from === to || [...this.#dependencies(from)].some((next) => this.#reaches(next, to));
  }

  #depth(name: string): number {
    const dependencies = [...this.#dependencies(name)];

    return dependencies.length === 0 ? 0 : 1 + Math.max(...dependencies.map((dependency) => this.#depth(dependency)));
  }
}

describe(DependencyGraph, () => {
  it.prop([fc.array(graphOperation, { maxLength: 30 })])('should match a plain model of its edges after any sequence of changes', (operations) => {
    const graph = new DependencyGraph();
    const model = new GraphModel();

    operations.forEach((operation, step) => {
      const refused = model.apply(operation);

      expect({ step, refused: refusesWithCycle(() => applyToGraph(graph, operation)) }).toEqual({ step, refused });
      expect({ step, state: stateOf(graph) }).toEqual({ step, state: model.state() });
    });
  });

  describe('constructor', () => {
    it('should create an empty graph', () => {
      const graph = new DependencyGraph();

      expect(graph.getDependenciesSize()).toBe(0);
      expect(graph.getDependentsSize()).toBe(0);
    });
  });

  describe('addDependency', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
      graph = new DependencyGraph();
    });

    it('should add a dependency edge', () => {
      graph.addDependency('A', 'B');

      expect(graph.getDependencies('A')).toEqual(new Set(['B']));
      expect(graph.getDependents('B')).toEqual(new Set(['A']));
    });

    it('should allow multiple dependencies from one node', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('A', 'D');

      expect(graph.getDependencies('A')).toEqual(new Set(['B', 'C', 'D']));
    });

    it('should allow multiple dependents on one node', () => {
      graph.addDependency('A', 'Z');
      graph.addDependency('B', 'Z');
      graph.addDependency('C', 'Z');

      expect(graph.getDependents('Z')).toEqual(new Set(['A', 'B', 'C']));
    });

    it('should throw on self-dependency', () => {
      expect(() => {
        graph.addDependency('A', 'A');
      }).toThrow(Errors.Runtime.CircularDependency.create({ nodeId: 'A', dependsOnId: 'A' }));
    });

    it('should throw on direct circular dependency', () => {
      graph.addDependency('A', 'B');

      expect(() => {
        graph.addDependency('B', 'A');
      }).toThrow(Errors.Runtime.CircularDependency.create({ nodeId: 'B', dependsOnId: 'A' }));
    });

    it('should throw on indirect circular dependency', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');

      expect(() => {
        graph.addDependency('C', 'A');
      }).toThrow(Errors.Runtime.CircularDependency.create({ nodeId: 'C', dependsOnId: 'A' }));
    });

    it('should throw on deep circular dependency', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      graph.addDependency('C', 'D');
      graph.addDependency('D', 'E');

      expect(() => {
        graph.addDependency('E', 'A');
      }).toThrow(Errors.Runtime.CircularDependency.create({ nodeId: 'E', dependsOnId: 'A' }));
    });

    it('should allow diamond dependencies (no cycle)', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('B', 'D');
      graph.addDependency('C', 'D');

      expect(graph.getDependencies('A')).toEqual(new Set(['B', 'C']));
      expect(graph.getDependents('D')).toEqual(new Set(['B', 'C']));
    });
  });

  describe('removeDependency', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
      graph = new DependencyGraph();
    });

    it('should remove a dependency edge', () => {
      graph.addDependency('A', 'B');
      graph.removeDependency('A', 'B');

      expect(graph.getDependencies('A')).toEqual(new Set());
      expect(graph.getDependents('B')).toEqual(new Set());
    });

    it('should prune orphaned nodes after removal', () => {
      graph.addDependency('A', 'B');
      graph.removeDependency('A', 'B');

      expect(graph.getDependenciesSize()).toBe(0);
      expect(graph.getDependentsSize()).toBe(0);
    });

    it('should not prune nodes that still have connections', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.removeDependency('A', 'B');

      expect(graph.getDependencies('A')).toEqual(new Set(['C']));
      expect(graph.getDependentsSize()).toBe(1);
    });

    it('should handle removal of non-existent edge', () => {
      expect(() => {
        graph.removeDependency('X', 'Y');
      }).not.toThrow();
    });
  });

  describe('replaceDependencies', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
      graph = new DependencyGraph();
    });

    it('should replace all dependencies atomically', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');

      graph.replaceDependencies('A', new Set(['D', 'E']));

      expect(graph.getDependencies('A')).toEqual(new Set(['D', 'E']));
    });

    it('should prune old dependencies that become orphaned', () => {
      graph.addDependency('A', 'B');
      graph.replaceDependencies('A', new Set(['C']));

      expect(graph.getDependents('B')).toEqual(new Set());
    });

    it('should update dependents correctly', () => {
      graph.addDependency('A', 'B');
      graph.replaceDependencies('A', new Set(['C', 'D']));

      expect(graph.getDependents('C')).toEqual(new Set(['A']));
      expect(graph.getDependents('D')).toEqual(new Set(['A']));
      expect(graph.getDependents('B')).toEqual(new Set());
    });

    it('should allow replacement with empty set', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');

      graph.replaceDependencies('A', new Set());

      expect(graph.getDependencies('A')).toEqual(new Set());
    });

    it('should throw on self-dependency in replacement set', () => {
      expect(() => {
        graph.replaceDependencies('A', new Set(['A']));
      }).toThrow(Errors.Runtime.CircularDependency.create({ nodeId: 'A', dependsOnId: 'A' }));
    });

    it('should throw if replacement would create cycle', () => {
      graph.addDependency('B', 'A');

      expect(() => {
        graph.replaceDependencies('A', new Set(['B']));
      }).toThrow(Errors.Runtime.CircularDependency.create({ nodeId: 'A', dependsOnId: 'B' }));
    });

    it('should throw if any dependency in set would create cycle', () => {
      graph.addDependency('C', 'B');
      graph.addDependency('B', 'A');

      expect(() => {
        graph.replaceDependencies('A', new Set(['D', 'C']));
      }).toThrow(Errors.Runtime.CircularDependency.create({ nodeId: 'A', dependsOnId: 'C' }));
    });

    it('should name the first dependency in the set when several would create a cycle', () => {
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'A');

      expect(() => {
        graph.replaceDependencies('A', new Set(['D', 'B', 'C']));
      }).toThrow(Errors.Runtime.CircularDependency.create({ nodeId: 'A', dependsOnId: 'B' }));
    });

    it('should not modify graph state when cycle detected', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');

      try {
        graph.replaceDependencies('C', new Set(['A']));
      }
      catch {
        // Expected
      }

      expect(graph.getDependencies('C')).toEqual(new Set());
      expect(graph.getDependencies('A')).toEqual(new Set(['B']));
    });
  });

  describe('removeAll', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
      graph = new DependencyGraph();
    });

    it('should remove a node and all its relationships', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('D', 'A');

      graph.removeAll('A');

      expect(graph.getDependencies('A')).toEqual(new Set());
      expect(graph.getDependents('A')).toEqual(new Set());
      expect(graph.getDependencies('D')).toEqual(new Set());
    });

    it('should prune orphaned nodes after removal', () => {
      graph.addDependency('A', 'B');
      graph.removeAll('A');

      expect(graph.getDependenciesSize()).toBe(0);
      expect(graph.getDependentsSize()).toBe(0);
    });

    it('should not prune nodes that still have other connections', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('C', 'B');

      graph.removeAll('A');

      expect(graph.getDependents('B')).toEqual(new Set(['C']));
    });

    it('should handle removal of non-existent node', () => {
      expect(() => {
        graph.removeAll('nonexistent');
      }).not.toThrow();
    });

    it('should handle complex graph removal', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('B', 'D');
      graph.addDependency('C', 'D');
      graph.addDependency('E', 'A');

      graph.removeAll('A');

      expect(graph.getDependencies('E')).toEqual(new Set());
      expect(graph.getDependents('B')).toEqual(new Set());
      expect(graph.getDependents('C')).toEqual(new Set());
    });
  });

  describe('cleanup', () => {
    it.prop([
      fc.array(
        fc.record({
          from: fc.string({ minLength: 1, maxLength: 3 }),
          to: fc.string({ minLength: 1, maxLength: 3 }),
        }),
        { minLength: 0, maxLength: 10 },
      ),
    ])(
      'should have empty graph after cleanup regardless of prior state',
      (edges) => {
        const graph = new DependencyGraph();

        for (const { from, to } of edges) {
          if (from !== to) {
            try {
              graph.addDependency(from, to);
            }
            catch {
              // Cycle detected, skip
            }
          }
        }

        graph.cleanup();

        expect(graph.getDependenciesSize()).toBe(0);
        expect(graph.getDependentsSize()).toBe(0);
      },
    );

    it('should clear all data from the graph', () => {
      const graph = new DependencyGraph();
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      graph.addDependency('C', 'D');

      graph.cleanup();

      expect(graph.getDependenciesSize()).toBe(0);
      expect(graph.getDependentsSize()).toBe(0);
      expect(graph.getDependencies('A')).toEqual(new Set());
      expect(graph.getDependents('B')).toEqual(new Set());
    });
  });

  describe('getDependents', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
      graph = new DependencyGraph();
    });

    it('should return empty set for node with no dependents', () => {
      expect(graph.getDependents('nonexistent')).toEqual(new Set());
    });

    it('should return all direct dependents', () => {
      graph.addDependency('A', 'Z');
      graph.addDependency('B', 'Z');
      graph.addDependency('C', 'Z');

      const dependents = graph.getDependents('Z');

      expect(dependents).toEqual(new Set(['A', 'B', 'C']));
    });

    it('should return readonly set', () => {
      graph.addDependency('A', 'B');

      const dependents = graph.getDependents('B');

      expect(Object.isFrozen(dependents) || dependents instanceof Set).toBe(true);
    });
  });

  describe('getDependencies', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
      graph = new DependencyGraph();
    });

    it('should return empty set for node with no dependencies', () => {
      expect(graph.getDependencies('nonexistent')).toEqual(new Set());
    });

    it('should return all direct dependencies', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('A', 'D');

      const dependencies = graph.getDependencies('A');

      expect(dependencies).toEqual(new Set(['B', 'C', 'D']));
    });
  });

  describe('getDependentsSize', () => {
    it('should return 0 for empty graph', () => {
      const graph = new DependencyGraph();

      expect(graph.getDependentsSize()).toBe(0);
    });

    it('should return count of nodes with dependents', () => {
      const graph = new DependencyGraph();
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('B', 'D');

      expect(graph.getDependentsSize()).toBe(3);
    });

    it('should not count a node whose dependents were all removed while it keeps dependencies', () => {
      const graph = new DependencyGraph();
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');

      graph.removeDependency('A', 'B');

      expect(graph.getDependentsSize()).toBe(1);
    });
  });

  describe('getDependenciesSize', () => {
    it('should return 0 for empty graph', () => {
      const graph = new DependencyGraph();

      expect(graph.getDependenciesSize()).toBe(0);
    });

    it('should return count of nodes with dependencies', () => {
      const graph = new DependencyGraph();
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('B', 'D');

      expect(graph.getDependenciesSize()).toBe(2);
    });

    it.each([
      { name: 'replaced with none', change: (graph: DependencyGraph) => graph.replaceDependencies('B', new Set()) },
      { name: 'removed one by one', change: (graph: DependencyGraph) => graph.removeDependency('B', 'C') },
    ])('should not count a node that still has dependents once its dependencies are $name', ({ change }) => {
      const graph = new DependencyGraph();
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');

      change(graph);

      expect(graph.getDependenciesSize()).toBe(1);
    });
  });

  describe('getNodeDepth', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
      graph = new DependencyGraph();
    });

    it('should return 0 for node with no dependencies', () => {
      graph.addDependency('A', 'B');

      expect(graph.getNodeDepth('B')).toBe(0);
    });

    it('should return 1 for node with one level of dependencies', () => {
      graph.addDependency('A', 'B');

      expect(graph.getNodeDepth('A')).toBe(1);
    });

    it('should return correct depth for chain', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      graph.addDependency('C', 'D');

      expect(graph.getNodeDepth('A')).toBe(3);
      expect(graph.getNodeDepth('B')).toBe(2);
      expect(graph.getNodeDepth('C')).toBe(1);
      expect(graph.getNodeDepth('D')).toBe(0);
    });

    it('should return max depth for diamond pattern', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('B', 'D');
      graph.addDependency('C', 'D');

      expect(graph.getNodeDepth('A')).toBe(2);
      expect(graph.getNodeDepth('B')).toBe(1);
      expect(graph.getNodeDepth('C')).toBe(1);
      expect(graph.getNodeDepth('D')).toBe(0);
    });

    it('should return 0 for non-existent node', () => {
      expect(graph.getNodeDepth('nonexistent')).toBe(0);
    });

    it('should cache depth calculations', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');

      const depth1 = graph.getNodeDepth('A');
      const depth2 = graph.getNodeDepth('A');

      expect(depth1).toBe(depth2);
      expect(depth1).toBe(2);
    });

    it('should invalidate cache when dependencies change', () => {
      graph.addDependency('A', 'B');
      expect(graph.getNodeDepth('A')).toBe(1);

      graph.addDependency('B', 'C');
      expect(graph.getNodeDepth('A')).toBe(2);
    });

    it('should invalidate cache even when intermediate nodes are not cached', () => {
      // Regression test: cache invalidation must propagate through dependent chain
      // even if intermediate nodes (B) were never cached
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      expect(graph.getNodeDepth('A')).toBe(2);

      graph.addDependency('C', 'D');
      expect(graph.getNodeDepth('A')).toBe(3);
    });

    it('should invalidate cache of the removed node and of its dependents on removeAll', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('B', 'D');
      expect(graph.getNodeDepth('A')).toBe(2);
      expect(graph.getNodeDepth('B')).toBe(1);

      graph.removeAll('B');

      expect(graph.getNodeDepth('A')).toBe(1);
      expect(graph.getNodeDepth('B')).toBe(0);
    });
  });

  describe('orphan pruning', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
      graph = new DependencyGraph();
    });

    it('should prune node when it loses all dependencies and dependents', () => {
      graph.addDependency('A', 'B');
      graph.removeDependency('A', 'B');

      expect(graph.getDependenciesSize()).toBe(0);
      expect(graph.getDependentsSize()).toBe(0);
    });

    it('should not prune node that still has dependents', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('C', 'B');
      graph.removeDependency('A', 'B');

      expect(graph.getDependents('B')).toEqual(new Set(['C']));
    });

    it('should not prune node that still has dependencies', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.removeDependency('A', 'B');

      expect(graph.getDependencies('A')).toEqual(new Set(['C']));
    });

    it('should cascade prune when removal creates orphans', () => {
      graph.addDependency('A', 'B');

      graph.removeAll('A');

      expect(graph.getDependenciesSize()).toBe(0);
      expect(graph.getDependentsSize()).toBe(0);
    });
  });

  describe('edge cases', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
      graph = new DependencyGraph();
    });

    it('should handle adding same dependency twice', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'B');

      expect(graph.getDependencies('A')).toEqual(new Set(['B']));
      expect(graph.getDependencies('A').size).toBe(1);
    });

    it('should handle empty node IDs', () => {
      graph.addDependency('', 'B');

      expect(graph.getDependencies('')).toEqual(new Set(['B']));
    });

    it('should handle special characters in node IDs', () => {
      graph.addDependency('node:1', 'node:2');
      graph.addDependency('node/a', 'node/b');
      graph.addDependency('node.x', 'node.y');

      expect(graph.getDependencies('node:1')).toEqual(new Set(['node:2']));
      expect(graph.getDependencies('node/a')).toEqual(new Set(['node/b']));
      expect(graph.getDependencies('node.x')).toEqual(new Set(['node.y']));
    });

    it('should maintain consistency after many operations', () => {
      for (let i = 0; i < 100; i++) {
        graph.addDependency(`node${i}`, `node${i + 100}`);
      }

      for (let i = 0; i < 50; i++) {
        graph.removeDependency(`node${i}`, `node${i + 100}`);
      }

      expect(graph.getDependenciesSize()).toBe(50);
    });
  });

  describe('error handling', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
      graph = new DependencyGraph();
    });

    it('should throw CircularDependency error with correct payload', () => {
      graph.addDependency('A', 'B');

      try {
        graph.addDependency('B', 'A');
        expect.fail('Should have thrown');
      }
      catch (error) {
        expect(Errors.Runtime.CircularDependency.is(error)).toBe(true);
        if (Errors.Runtime.CircularDependency.is(error)) {
          expect(error.payload.nodeId).toBe('B');
          expect(error.payload.dependsOnId).toBe('A');
        }
      }
    });

    it('should recover from failed addDependency', () => {
      graph.addDependency('A', 'B');

      try {
        graph.addDependency('B', 'A');
      }
      catch {
        // Expected
      }

      expect(graph.getDependencies('A')).toEqual(new Set(['B']));
      expect(graph.getDependencies('B')).toEqual(new Set());

      graph.addDependency('B', 'C');
      expect(graph.getDependencies('B')).toEqual(new Set(['C']));
    });

    it('should recover from failed replaceDependencies', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');

      try {
        graph.replaceDependencies('C', new Set(['A', 'X']));
      }
      catch {
        // Expected
      }

      expect(graph.getDependencies('C')).toEqual(new Set());
      expect(graph.getDependencies('A')).toEqual(new Set(['B']));

      graph.replaceDependencies('C', new Set(['D']));
      expect(graph.getDependencies('C')).toEqual(new Set(['D']));
    });
  });
});

function applyToGraph(graph: DependencyGraph, operation: GraphOperation): void {
  switch (operation.type) {
    case 'add':
      graph.addDependency(operation.node, operation.dependsOn);
      break;
    case 'remove':
      graph.removeDependency(operation.node, operation.dependsOn);
      break;
    case 'replace':
      graph.replaceDependencies(operation.node, new Set(operation.dependencies));
      break;
    case 'removeAll':
      graph.removeAll(operation.node);
      break;
  }
}

/** Runs the change and reports whether it fails with a circular dependency; any other failure is rethrown. */
function refusesWithCycle(change: () => void): boolean {
  try {
    change();

    return false;
  }
  catch (error) {
    if (Errors.Runtime.CircularDependency.is(error)) {
      return true;
    }

    throw error;
  }
}

function stateOf(graph: DependencyGraph): GraphState {
  return {
    nodes: Object.fromEntries(NODES.map((name) => [name, {
      dependencies: [...graph.getDependencies(name)].sort(),
      dependents: [...graph.getDependents(name)].sort(),
      depth: graph.getNodeDepth(name),
    }])),
    dependenciesSize: graph.getDependenciesSize(),
    dependentsSize: graph.getDependentsSize(),
  };
}
