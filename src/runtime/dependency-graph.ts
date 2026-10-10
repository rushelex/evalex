import { Errors } from '../core/errors';

// Shared empty set to avoid allocations
const EMPTY_SET: ReadonlySet<string> = new Set();

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
  // Cache for node depths - invalidated on graph changes
  readonly #depthCache = new Map<string, number>();

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
    // Batch cycle detection - check all deps at once using single BFS
    const cycleTarget = this.#wouldCreateCycleBatch(nodeId, deps);
    if (cycleTarget !== null) {
      throw Errors.Runtime.CircularDependency.create({
        nodeId,
        dependsOnId: cycleTarget,
      });
    }

    // Invalidate depth cache for affected nodes
    this.#invalidateDepthCache(nodeId);

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
    if (this.#wouldCreateCycleSingle(nodeId, dependsOnId)) {
      throw Errors.Runtime.CircularDependency.create({
        nodeId,
        dependsOnId,
      });
    }

    // Invalidate depth cache
    this.#invalidateDepthCache(nodeId);

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

    this.#invalidateDepthCache(nodeId);
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
    // Invalidate before the edges go, so the walk still reaches every dependent
    this.#invalidateDepthCache(nodeId);

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
    this.#depthCache.clear();
  }

  /**
   * Gets all nodes that depend on the specified node.
   *
   * @param nodeId - The node to find dependents for
   * @returns The internal Set for iteration - do NOT modify!
   */
  getDependents(nodeId: string): ReadonlySet<string> {
    return this.#dependents.get(nodeId) ?? EMPTY_SET;
  }

  /**
   * Gets all nodes that the specified node depends on.
   *
   * @param nodeId - The node to find dependencies for
   * @returns The internal Set for iteration - do NOT modify!
   */
  getDependencies(nodeId: string): ReadonlySet<string> {
    return this.#dependencies.get(nodeId) ?? EMPTY_SET;
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
   * Gets the depth of the node in the graph with caching.
   *
   * @param nodeId - The node to find depth for
   * @returns Depth of the node
   */
  getNodeDepth(nodeId: string): number {
    const cached = this.#depthCache.get(nodeId);
    if (cached !== undefined) {
      return cached;
    }

    const depth = this.#calculateDepth(nodeId, new Set());
    this.#depthCache.set(nodeId, depth);
    return depth;
  }

  /**
   * Batch cycle detection - checks if adding edges from nodeId to any dep would create a cycle.
   * Single BFS from all deps simultaneously.
   *
   * @returns The dependency that would create a cycle, or null if safe
   */
  #wouldCreateCycleBatch(nodeId: string, deps: ReadonlySet<string>): string | null {
    if (deps.size === 0)
      return null;

    // Quick check: if nodeId depends on itself
    if (deps.has(nodeId))
      return nodeId;

    // BFS from all deps at once - check if any path leads to nodeId
    const queue: string[] = [];
    const visited = new Set<string>();

    for (const dep of deps) {
      if (!visited.has(dep)) {
        visited.add(dep);
        queue.push(dep);
      }
    }

    let idx = 0;
    while (idx < queue.length) {
      const current = queue[idx++];

      if (current === nodeId) {
        // Find which original dep led here (for error message)
        // Return the first dep that was in the path
        return this.#findCycleCause(nodeId, deps);
      }

      const currentDeps = this.#dependencies.get(current);
      if (currentDeps) {
        for (const dep of currentDeps) {
          if (!visited.has(dep)) {
            visited.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    return null;
  }

  /**
   * Find which dependency would cause the cycle (for error messages)
   *
   * @param nodeId - The node to find cycle cause for
   * @param deps - The dependencies to check
   * @returns The dependency that would cause the cycle
   */
  #findCycleCause(nodeId: string, deps: ReadonlySet<string>): string {
    for (const dep of deps) {
      if (this.#wouldCreateCycleSingle(nodeId, dep)) {
        return dep;
      }
    }
    return deps.values().next().value!;
  }

  /**
   * Single cycle detection using index-based queue (O(1) dequeue)
   *
   * @param nodeId - The node to find cycle cause for
   * @param dependsOnId - The dependency to check
   * @returns True if a cycle would be created, false otherwise
   */
  #wouldCreateCycleSingle(nodeId: string, dependsOnId: string): boolean {
    if (nodeId === dependsOnId)
      return true;

    const queue = [dependsOnId];
    const visited = new Set<string>([dependsOnId]);
    let idx = 0;

    while (idx < queue.length) {
      const current = queue[idx++];

      if (current === nodeId) {
        return true;
      }

      const currentDeps = this.#dependencies.get(current);
      if (currentDeps) {
        for (const dep of currentDeps) {
          if (!visited.has(dep)) {
            visited.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    return false;
  }

  /**
   * Calculate depth using iterative approach with explicit stack
   *
   * @param nodeId - The node to calculate depth for
   * @param visited - Set of visited nodes to detect cycles
   * @returns The depth of the node
   */
  #calculateDepth(nodeId: string, visited: Set<string>): number {
    if (visited.has(nodeId)) {
      return Infinity; // Cycle
    }

    const deps = this.#dependencies.get(nodeId);
    if (!deps || deps.size === 0) {
      return 0;
    }

    visited.add(nodeId);

    let maxDepth = 0;
    for (const depId of deps) {
      // Check cache first
      let depDepth = this.#depthCache.get(depId);
      if (depDepth === undefined) {
        depDepth = this.#calculateDepth(depId, visited);
      }
      if (depDepth > maxDepth) {
        maxDepth = depDepth;
      }
    }

    visited.delete(nodeId);
    return maxDepth + 1;
  }

  /**
   * Invalidate depth cache for a node and all its dependents (nodes that depend on it).
   * Uses BFS to propagate invalidation through the dependent chain.
   * Visits dependents even if intermediate nodes are not cached, because
   * dependent nodes further up the chain may have cached values that need invalidation.
   *
   * @param nodeId - The node to invalidate depth cache for
   */
  #invalidateDepthCache(nodeId: string): void {
    const toInvalidate = [nodeId];
    const visited = new Set<string>([nodeId]);
    let idx = 0;

    while (idx < toInvalidate.length) {
      const current = toInvalidate[idx++];
      this.#depthCache.delete(current);

      const dependents = this.#dependents.get(current);
      if (dependents) {
        for (const dep of dependents) {
          if (!visited.has(dep)) {
            visited.add(dep);
            toInvalidate.push(dep);
          }
        }
      }
    }
  }

  /**
   * Fast orphan check without creating arrays
   *
   * @param nodeId - The node to check for orphan status
   */
  #maybePrune(nodeId: string): void {
    // An empty set is dropped on its own, so the sizes count only nodes that have edges on that side
    if (this.#dependencies.get(nodeId)?.size === 0) {
      this.#dependencies.delete(nodeId);
    }

    if (this.#dependents.get(nodeId)?.size === 0) {
      this.#dependents.delete(nodeId);
    }

    if (!this.#dependencies.has(nodeId) && !this.#dependents.has(nodeId)) {
      this.#depthCache.delete(nodeId);
    }
  }
}
