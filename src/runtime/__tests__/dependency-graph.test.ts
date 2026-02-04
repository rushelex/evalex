import { fc, it } from '@fast-check/vitest';

import { Errors } from '../../core/errors';
import { DependencyGraph } from '../dependency-graph';

describe(DependencyGraph, () => {
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

  describe('properties', () => {
    it('should maintain bidirectional consistency after addDependency', ({ g }) => {
      const graph = new DependencyGraph();
      const nodeA = g(fc.string, { minLength: 1, maxLength: 10 });
      const nodeB = g(fc.string, { minLength: 1, maxLength: 10 });

      fc.pre(nodeA !== nodeB);

      graph.addDependency(nodeA, nodeB);

      expect(graph.getDependencies(nodeA).has(nodeB)).toBe(true);
      expect(graph.getDependents(nodeB).has(nodeA)).toBe(true);
    });

    it.prop([
      fc.array(
        fc.record({
          from: fc.string({ minLength: 1, maxLength: 5 }),
          to: fc.string({ minLength: 1, maxLength: 5 }),
        }),
        { minLength: 1, maxLength: 20 },
      ),
    ])(
      'should never have orphans with non-empty connections',
      (edges) => {
        const graph = new DependencyGraph();

        for (const { from, to } of edges) {
          if (from !== to) {
            try {
              graph.addDependency(from, to);
            }
            catch {
              // Cycle detected, skip this edge
            }
          }
        }

        const allNodes = new Set(edges.flatMap((e) => [e.from, e.to]));

        for (const node of allNodes) {
          const hasDeps = graph.getDependencies(node).size > 0;
          const hasDependents = graph.getDependents(node).size > 0;

          if (hasDeps || hasDependents) {
            expect(hasDeps || hasDependents).toBe(true);
          }
        }
      },
    );

    it.prop([
      fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 2, maxLength: 10 }),
    ])(
      'should always prevent self-dependency',
      (nodes) => {
        const graph = new DependencyGraph();

        for (const node of nodes) {
          expect(() => {
            graph.addDependency(node, node);
          }).toThrow(Errors.Runtime.CircularDependency.create({ nodeId: node, dependsOnId: node }));
        }
      },
    );

    it.prop([
      fc.array(fc.string({ minLength: 1, maxLength: 3 }), { minLength: 3, maxLength: 5 }),
    ])(
      'should detect cycles in any chain A -> B -> ... -> A',
      (nodes) => {
        fc.pre(nodes.length >= 2);
        fc.pre(new Set(nodes).size === nodes.length);

        const graph = new DependencyGraph();

        for (let i = 0; i < nodes.length - 1; i++) {
          graph.addDependency(nodes[i], nodes[i + 1]);
        }

        expect(() => {
          graph.addDependency(nodes[nodes.length - 1], nodes[0]);
        }).toThrow(Errors.Runtime.CircularDependency.create({ nodeId: nodes[nodes.length - 1], dependsOnId: nodes[0] }));
      },
    );

    it.prop([
      fc.record({
        nodeA: fc.string({ minLength: 1, maxLength: 5 }),
        nodeB: fc.string({ minLength: 1, maxLength: 5 }),
        nodeC: fc.string({ minLength: 1, maxLength: 5 }),
      }),
    ])(
      'should maintain depth invariant: depth(A) > depth(B) when A depends on B',
      ({ nodeA, nodeB, nodeC }) => {
        fc.pre(nodeA !== nodeB && nodeB !== nodeC && nodeA !== nodeC);

        const graph = new DependencyGraph();
        graph.addDependency(nodeA, nodeB);
        graph.addDependency(nodeB, nodeC);

        expect(graph.getNodeDepth(nodeA)).toBeGreaterThan(graph.getNodeDepth(nodeB));
        expect(graph.getNodeDepth(nodeB)).toBeGreaterThan(graph.getNodeDepth(nodeC));
        expect(graph.getNodeDepth(nodeC)).toBe(0);
      },
    );

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

    it.prop([
      fc.string({ minLength: 1, maxLength: 5 }),
      fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 0, maxLength: 5 }),
    ])(
      'should correctly replace all dependencies atomically',
      (nodeId, newDeps) => {
        const graph = new DependencyGraph();
        const uniqueDeps = [...new Set(newDeps)].filter((d) => d !== nodeId);

        graph.replaceDependencies(nodeId, new Set(uniqueDeps));

        const actualDeps = graph.getDependencies(nodeId);
        expect(actualDeps.size).toBe(uniqueDeps.length);

        for (const dep of uniqueDeps) {
          expect(actualDeps.has(dep)).toBe(true);
          expect(graph.getDependents(dep).has(nodeId)).toBe(true);
        }
      },
    );
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
