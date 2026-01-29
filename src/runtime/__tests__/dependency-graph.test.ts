import { DependencyGraph } from '../dependency-graph';
import { CircularDependencyError } from '../errors';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('Basic Operations', () => {
    it('adds and retrieves dependencies', () => {
      graph.addDependency('A', 'B');

      expect(graph.getDependencies('A')).toEqual(new Set(['B']));
      expect(graph.getDependents('B')).toEqual(new Set(['A']));
    });

    it('removes individual dependencies', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');

      graph.removeDependency('A', 'B');

      expect(graph.getDependencies('A')).toEqual(new Set(['C']));
      expect(graph.getDependents('B')).toEqual(new Set());
    });

    it('prevents circular dependencies', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');

      expect(() => graph.addDependency('C', 'A')).toThrow(CircularDependencyError);
    });

    it('handles non-existent nodes gracefully', () => {
      expect(graph.getDependencies('X')).toEqual(new Set());
      expect(graph.getDependents('X')).toEqual(new Set());

      // Should not throw
      graph.removeAll('X');
      graph.removeDependency('X', 'Y');
    });
  });

  describe('replaceDependencies', () => {
    it('replaces all dependencies atomically', () => {
      // Initial setup: B depends on A and C
      graph.addDependency('B', 'A');
      graph.addDependency('B', 'C');

      expect(graph.getDependencies('B')).toEqual(new Set(['A', 'C']));
      expect(graph.getDependents('A')).toEqual(new Set(['B']));
      expect(graph.getDependents('C')).toEqual(new Set(['B']));

      // Replace with new set: B depends on C and D
      graph.replaceDependencies('B', new Set(['C', 'D']));

      expect(graph.getDependencies('B')).toEqual(new Set(['C', 'D']));
      expect(graph.getDependents('A')).toEqual(new Set()); // A is orphaned and removed
      expect(graph.getDependents('C')).toEqual(new Set(['B']));
      expect(graph.getDependents('D')).toEqual(new Set(['B']));
    });

    it('handles replacing with empty set', () => {
      // Setup: Complex dependency chain
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('D', 'A');

      // Replace A's dependencies with empty set
      graph.replaceDependencies('A', new Set());

      expect(graph.getDependencies('A')).toEqual(new Set());
      // A still exists because D depends on it
      expect(graph.getDependents('A')).toEqual(new Set(['D']));
      // B and C are orphaned and removed from maps
      expect(graph.getDependencies('B')).toEqual(new Set());
      expect(graph.getDependencies('C')).toEqual(new Set());
      // D and A remain in dependencies map
      expect(graph.getDependenciesSize()).toBe(2); // D and A
    });

    it('handles replacing with same dependencies', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');

      const sizeBefore = graph.getDependenciesSize();

      // Replace with same set
      graph.replaceDependencies('A', new Set(['B', 'C']));

      expect(graph.getDependencies('A')).toEqual(new Set(['B', 'C']));
      expect(graph.getDependenciesSize()).toBe(sizeBefore);
    });

    it('prevents circular dependencies in replacement', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');

      // Attempting to create cycle through replacement
      expect(() => graph.replaceDependencies('C', new Set(['A']))).toThrow(CircularDependencyError);
    });
  });

  describe('removeAll', () => {
    it('removes all relationships for a node and prunes orphans', () => {
      // Setup: A depends on B and C, D depends on A
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('D', 'A');

      graph.removeAll('A');

      // A is completely removed
      expect(graph.getDependencies('A')).toEqual(new Set());
      expect(graph.getDependents('A')).toEqual(new Set());
      // D is also pruned because it has no dependencies after A is removed
      expect(graph.getDependencies('D')).toEqual(new Set());
      // B and C are removed as orphans (fixed!)
      expect(graph.getDependents('B')).toEqual(new Set());
      expect(graph.getDependents('C')).toEqual(new Set());
      // After fix: all nodes are pruned (D, B, and C become orphans)
      expect(graph.getDependenciesSize()).toBe(0); // All pruned
      expect(graph.getDependentsSize()).toBe(0); // All orphans pruned
    });

    it('handles removing non-existent node', () => {
      graph.addDependency('A', 'B');

      const sizeBefore = graph.getDependenciesSize();
      graph.removeAll('Z'); // Non-existent node

      expect(graph.getDependenciesSize()).toBe(sizeBefore);
    });

    it('handles complex removal scenarios', () => {
      // Setup: E depends on A and C
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('D', 'A');
      graph.addDependency('E', 'A');
      graph.addDependency('E', 'C');

      // Remove A
      graph.removeAll('A');

      // D is removed as orphan
      expect(graph.getDependencies('D')).toEqual(new Set());
      // E still exists and depends only on C
      expect(graph.getDependencies('E')).toEqual(new Set(['C']));
      // B is removed as orphan
      expect(graph.getDependents('B')).toEqual(new Set());
      // C still has E as dependent
      expect(graph.getDependents('C')).toEqual(new Set(['E']));
    });
  });

  describe('Orphan Pruning', () => {
    it('removes orphans after removeDependency', () => {
      graph.addDependency('B', 'A');

      // Remove dependency, both nodes should be pruned
      graph.removeDependency('B', 'A');

      expect(graph.getDependenciesSize()).toBe(0);
      expect(graph.getDependentsSize()).toBe(0);
    });

    it('removes orphans after replaceDependencies', () => {
      graph.addDependency('B', 'A');

      // Replace with empty set
      graph.replaceDependencies('B', new Set());

      // Both nodes should be pruned
      expect(graph.getDependenciesSize()).toBe(0);
      expect(graph.getDependentsSize()).toBe(0);
    });

    it('removes orphans after removeAll', () => {
      // Create a simple chain: A -> B
      graph.addDependency('A', 'B');

      // Remove A - this should also remove B since it becomes orphaned
      graph.removeAll('A');

      // After fix: B is correctly removed as orphan
      expect(graph.getDependenciesSize()).toBe(0);
      expect(graph.getDependentsSize()).toBe(0);
    });

    it('keeps nodes with remaining connections', () => {
      // Create: A -> B, C -> B
      graph.addDependency('A', 'B');
      graph.addDependency('C', 'B');

      // Remove A
      graph.removeAll('A');

      // B is not orphaned because C still depends on it
      expect(graph.getDependents('B')).toEqual(new Set(['C']));
      expect(graph.getDependenciesSize()).toBe(1); // Only C
      expect(graph.getDependentsSize()).toBe(1); // Only B
    });

    it('handles complex orphan chains', () => {
      // Create chain: A -> B -> C -> D
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      graph.addDependency('C', 'D');

      // Remove B - this breaks the chain
      graph.removeAll('B');

      // A becomes orphan and is removed
      // C still exists (it depends on D)
      // D still exists (C depends on it)
      expect(graph.getDependenciesSize()).toBe(1); // C -> D
      expect(graph.getDependentsSize()).toBe(2); // C and D both in dependents map
    });
  });

  describe('Real-World Scenarios', () => {
    it('simulates formula recalculation with changing dependencies', () => {
      // Initial formula: A = B + C
      graph.replaceDependencies('A', new Set(['B', 'C']));

      // Another formula uses A: D = A * 2
      graph.replaceDependencies('D', new Set(['A']));

      expect(graph.getDependents('B')).toEqual(new Set(['A']));
      expect(graph.getDependents('A')).toEqual(new Set(['D']));

      // Formula A changes to: A = B + E (no longer uses C)
      graph.replaceDependencies('A', new Set(['B', 'E']));

      expect(graph.getDependents('C')).toEqual(new Set()); // C is orphaned
      expect(graph.getDependents('E')).toEqual(new Set(['A']));
      expect(graph.getDependents('B')).toEqual(new Set(['A']));
      expect(graph.getDependents('A')).toEqual(new Set(['D']));
    });

    it('simulates property removal cascade', () => {
      // Complex dependency tree
      // A depends on B, C
      // D depends on A
      // E depends on A, C
      graph.replaceDependencies('A', new Set(['B', 'C']));
      graph.replaceDependencies('D', new Set(['A']));
      graph.replaceDependencies('E', new Set(['A', 'C']));

      // Remove property A
      graph.removeAll('A');

      // D becomes orphaned and is removed
      expect(graph.getDependencies('D')).toEqual(new Set());
      // E still exists, depends only on C
      expect(graph.getDependencies('E')).toEqual(new Set(['C']));
      // B becomes orphaned
      expect(graph.getDependents('B')).toEqual(new Set());
      // C still has E as dependent
      expect(graph.getDependents('C')).toEqual(new Set(['E']));
    });

    it('handles batch updates efficiently', () => {
      // Simulate multiple formulas being updated in a batch
      const updates = [
        { id: 'A', deps: new Set(['X', 'Y']) },
        { id: 'B', deps: new Set(['Y', 'Z']) },
        { id: 'C', deps: new Set(['A', 'B']) },
        { id: 'D', deps: new Set(['C']) },
      ];

      // Apply all updates
      updates.forEach(({ id, deps }) => {
        graph.replaceDependencies(id, deps);
      });

      // Verify the graph structure
      expect(graph.getDependents('X')).toEqual(new Set(['A']));
      expect(graph.getDependents('Y')).toEqual(new Set(['A', 'B']));
      expect(graph.getDependents('Z')).toEqual(new Set(['B']));
      expect(graph.getDependents('A')).toEqual(new Set(['C']));
      expect(graph.getDependents('B')).toEqual(new Set(['C']));
      expect(graph.getDependents('C')).toEqual(new Set(['D']));

      // Simulate removing intermediate node
      graph.removeAll('C');

      // D becomes orphaned
      expect(graph.getDependencies('D')).toEqual(new Set());
      // A and B no longer have dependents
      expect(graph.getDependents('A')).toEqual(new Set());
      expect(graph.getDependents('B')).toEqual(new Set());
    });
  });

  describe('Graph Size Tracking', () => {
    it('tracks dependencies size correctly', () => {
      expect(graph.getDependenciesSize()).toBe(0);

      graph.addDependency('A', 'B');
      expect(graph.getDependenciesSize()).toBe(1); // A

      graph.addDependency('C', 'D');
      expect(graph.getDependenciesSize()).toBe(2); // A, C

      graph.removeAll('A');
      expect(graph.getDependenciesSize()).toBe(1); // Only C
    });

    it('tracks dependents size correctly', () => {
      expect(graph.getDependentsSize()).toBe(0);

      graph.addDependency('A', 'B');
      expect(graph.getDependentsSize()).toBe(1); // B

      graph.addDependency('C', 'B');
      expect(graph.getDependentsSize()).toBe(1); // Still only B

      graph.addDependency('A', 'D');
      expect(graph.getDependentsSize()).toBe(2); // B and D
    });
  });
});
