/**
 * Internal analyzer for graph operations.
 * Provides read-only analysis methods without modifying the graph.
 */
export class DependencyGraphAnalyzer {
  constructor(
    private readonly getDependencies: (nodeId: string) => string[],
    private readonly getDependents: (nodeId: string) => string[],
  ) {}

  /**
   * Checks if adding an edge from 'nodeId' to 'dependsOnId' would create a cycle.
   * Uses BFS to check if there's already a path from 'dependsOnId' to 'nodeId'.
   * If such a path exists, adding the reverse edge would create a cycle.
   *
   * @param nodeId - The potential source of the new edge
   * @param dependsOnId - The potential target of the new edge
   * @returns true if adding the edge would create a cycle
   */
  public wouldCreateCycle(nodeId: string, dependsOnId: string): boolean {
    // If nodeId depends on dependsOnId, then dependsOnId cannot depend on nodeId
    const queue = [dependsOnId];
    const visited = new Set<string>([dependsOnId]);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === nodeId) {
        return true;
      }

      for (const dep of this.getDependencies(current)) {
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push(dep);
        }
      }
    }

    return false;
  }

  /**
   * Calculates the depth of a node in the dependency graph.
   * Depth is the longest path from this node to any leaf node (node with no dependencies).
   * Returns 0 for nodes with no dependencies.
   *
   * @param nodeId - The node to calculate depth for
   * @returns The maximum depth from this node
   */
  public getNodeDepth(nodeId: string): number {
    const visited = new Set<string>();

    const calculateDepth = (currentId: string): number => {
      if (visited.has(currentId)) {
        // Cycle detected - return Infinity to indicate circular dependency
        return Infinity;
      }

      visited.add(currentId);

      const dependencies = this.getDependencies(currentId);
      if (dependencies.length === 0) {
        visited.delete(currentId);
        return 0;
      }

      let maxDepth = 0;
      for (const depId of dependencies) {
        const depth = calculateDepth(depId);
        maxDepth = Math.max(maxDepth, depth);
      }

      visited.delete(currentId);
      return maxDepth + 1;
    };

    return calculateDepth(nodeId);
  }

  /**
   * Finds all root nodes (nodes with no incoming dependencies).
   * These are nodes that no other node depends on.
   *
   * @returns Array of root node IDs
   */
  public findRoots(allNodeIds: string[]): string[] {
    return allNodeIds.filter((nodeId) => this.getDependents(nodeId).length === 0);
  }

  /**
   * Finds all leaf nodes (nodes with no outgoing dependencies).
   * These are nodes that don't depend on any other nodes.
   *
   * @returns Array of leaf node IDs
   */
  public findLeaves(allNodeIds: string[]): string[] {
    return allNodeIds.filter((nodeId) => this.getDependencies(nodeId).length === 0);
  }

  /**
   * Calculates the total number of nodes affected if the given node changes.
   * This includes all direct and indirect dependents.
   *
   * @param nodeId - The node to analyze
   * @returns Number of nodes that would be affected
   */
  public calculateFanOut(nodeId: string): number {
    const queue = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      for (const dependent of this.getDependents(current)) {
        queue.push(dependent);
      }
    }

    // Subtract 1 to exclude the node itself
    return visited.size - 1;
  }

  /**
   * Checks if a node is orphaned (has no dependencies and no dependents).
   * Such nodes can be safely removed from the graph to prevent memory leaks.
   *
   * @param nodeId - The node to check
   * @returns true if the node has no connections and can be pruned
   */
  public isOrphaned(nodeId: string): boolean {
    const hasDependencies = this.getDependencies(nodeId).length > 0;
    const hasDependents = this.getDependents(nodeId).length > 0;

    return !hasDependencies && !hasDependents;
  }
}
