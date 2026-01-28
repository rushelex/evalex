import { DependencyGraphAnalyzer } from './dependency-graph-analyzer';
import { CircularDependencyError } from './errors';

/**
 * Stores dependencies and dependents between nodes.
 *
 * - **Automatic orphan pruning**: Nodes with no dependencies and no dependents
 *   are automatically removed from the graph to prevent memory leaks
 * - **Cycle prevention**: All operations that could create cycles are checked
 *   beforehand and will throw an error if a cycle would be created
 * - **Atomic bulk operations**: The `replaceDependencies` method ensures
 *   consistency during complex dependency updates
 * - **Efficient memory usage**: Uses Maps with Sets for O(1) lookups and
 *   automatic cleanup of empty entries
 *
 * @example
 * ```typescript
 * const graph = new DependencyGraph();
 *
 * // Add dependencies
 * graph.addDependency('A', 'B'); // A depends on B
 * graph.addDependency('A', 'C'); // A depends on C
 *
 * // Replace all dependencies atomically
 * graph.replaceDependencies('A', new Set(['D', 'E']));
 * // Now A depends on D and E; B and C are removed if orphaned
 *
 * // Remove a node - all orphans are cleaned up
 * graph.removeAll('A');
 * ```
 */
export class DependencyGraph {
  readonly #dependencies = new Map<string, Set<string>>();
  readonly #dependents = new Map<string, Set<string>>();
  readonly #analyzer = new DependencyGraphAnalyzer(
    (nodeId) => this.getDependencies(nodeId),
    (nodeId) => this.getDependents(nodeId),
  );

  /**
   * Atomically replaces all dependencies of a node with a new set.
   * This is preferred over multiple add/remove calls for consistency.
   * Implementations may perform cleanup of orphaned nodes.
   *
   * @param nodeId - The node whose dependencies to replace
   * @param deps - The new complete set of dependencies
   * @throws May throw if any of the new dependencies would create a cycle
   */
  replaceDependencies(nodeId: string, deps: ReadonlySet<string>): void {
    // Detect potential cycles before mutating the graph
    for (const dep of deps) {
      if (this.#analyzer.wouldCreateCycle(nodeId, dep)) {
        throw new CircularDependencyError(`Circular dependency detected between ${nodeId} and ${dep}.`, {
          context: {
            nodeId,
            dependsOnId: dep,
          },
        });
      }
    }

    const existing = this.#dependencies.get(nodeId) ?? new Set<string>();
    for (const dep of existing) {
      this.#dependents.get(dep)?.delete(nodeId);
      this.#maybePrune(dep);
    }

    this.#dependencies.set(nodeId, new Set(deps));

    for (const dep of deps) {
      if (!this.#dependents.has(dep)) {
        this.#dependents.set(dep, new Set());
      }
      this.#dependents.get(dep)!.add(nodeId);
    }

    // After replacement, nodeId may have lost all outgoing deps and no incoming
    this.#maybePrune(nodeId);
  }

  /**
   * Adds a dependency edge from nodeId to dependsOnId.
   * After this call, nodeId depends on dependsOnId.
   *
   * @param nodeId - The node that has the dependency
   * @param dependsOnId - The node being depended upon
   * @throws May throw if adding this edge would create a cycle
   */
  addDependency(nodeId: string, dependsOnId: string): void {
    // Detect potential cycles before mutating the graph
    if (this.#analyzer.wouldCreateCycle(nodeId, dependsOnId)) {
      throw new CircularDependencyError(`Circular dependency detected between ${nodeId} and ${dependsOnId}.`, {
        context: {
          nodeId,
          dependsOnId,
        },
      });
    }

    if (!this.#dependencies.has(nodeId)) {
      this.#dependencies.set(nodeId, new Set());
    }
    this.#dependencies.get(nodeId)!.add(dependsOnId);

    if (!this.#dependents.has(dependsOnId)) {
      this.#dependents.set(dependsOnId, new Set());
    }
    this.#dependents.get(dependsOnId)!.add(nodeId);
  }

  /**
   * Removes a specific dependency edge between two nodes.
   * Implementations may perform cleanup of orphaned nodes.
   *
   * @param nodeId - The node that has the dependency
   * @param dependsOnId - The node being depended upon
   */
  removeDependency(nodeId: string, dependsOnId: string): void {
    this.#dependencies.get(nodeId)?.delete(dependsOnId);
    this.#dependents.get(dependsOnId)?.delete(nodeId);

    this.#maybePrune(nodeId);
    this.#maybePrune(dependsOnId);
  }

  /**
   * Removes a node and all its relationships from the graph.
   * This includes both incoming and outgoing edges.
   * Implementations may perform cleanup of orphaned nodes.
   *
   * @param nodeId - The node to completely remove
   */
  removeAll(nodeId: string): void {
    // Collect nodes that might become orphaned
    const nodesToCheck = new Set<string>();

    // Nodes that nodeId depends on
    const dependencies = this.#dependencies.get(nodeId);
    if (dependencies) {
      for (const dep of dependencies) {
        nodesToCheck.add(dep);
      }
    }

    // Nodes that depend on nodeId
    const dependents = this.#dependents.get(nodeId);
    if (dependents) {
      for (const dep of dependents) {
        nodesToCheck.add(dep);
      }
    }

    // Remove nodeId from all relationships
    for (const deps of this.#dependencies.values()) {
      deps.delete(nodeId);
    }
    this.#dependencies.delete(nodeId);

    for (const deps of this.#dependents.values()) {
      deps.delete(nodeId);
    }
    this.#dependents.delete(nodeId);

    // Check and prune nodes that might have become orphaned
    for (const node of nodesToCheck) {
      this.#maybePrune(node);
    }
  }

  cleanup() {
    this.#dependencies.clear();
    this.#dependents.clear();
  }

  /**
   * Gets all nodes that depend on the specified node.
   * These are nodes that have edges pointing to nodeId.
   *
   * @param nodeId - The node to find dependents for
   * @returns Array of node IDs that depend on this node
   */
  getDependents(nodeId: string): string[] {
    return Array.from(this.#dependents.get(nodeId) || []);
  }

  /**
   * Gets all nodes that the specified node depends on.
   * These are nodes that nodeId has edges pointing to.
   *
   * @param nodeId - The node to find dependencies for
   * @returns Array of node IDs that this node depends on
   */
  getDependencies(nodeId: string): string[] {
    return Array.from(this.#dependencies.get(nodeId) || []);
  }

  /**
   * Gets the total number of nodes that have at least one dependent.
   * This is the size of the internal dependents tracking structure.
   *
   * @returns Number of nodes with dependents
   */
  getDependentsSize(): number {
    return this.#dependents.size;
  }

  /**
   * Gets the total number of nodes that have at least one dependency.
   * This is the size of the internal dependencies tracking structure.
   *
   * @returns Number of nodes with dependencies
   */
  getDependenciesSize(): number {
    return this.#dependencies.size;
  }

  /**
   * Gets the depth of the node in the graph.
   * Depth is defined as the maximum distance from the node to any other node.
   *
   * @param nodeId - The node to find depth for
   * @returns Depth of the node
   */
  getNodeDepth(nodeId: string): number {
    return this.#analyzer.getNodeDepth(nodeId);
  }

  /**
   * Removes orphaned nodes (nodes with no dependencies and no dependents).
   * This is O(1) for single candidate and avoids scanning whole maps.
   *
   * This method is called after any operation that might create orphaned nodes
   * to ensure the graph remains minimal and doesn't leak memory.
   */
  #maybePrune(nodeId: string): void {
    if (this.#analyzer.isOrphaned(nodeId)) {
      this.#dependencies.delete(nodeId);
      this.#dependents.delete(nodeId);
    }
  }
}
