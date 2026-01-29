# Dirty Marking + Topological Sort + Batching Migration Plan

## Executive Summary

This document outlines the migration plan for implementing Dirty Marking + Topological Sort + Batching in the formula runtime. This plan **assumes SoA migration (Plan 001) is already complete**.

### Prerequisites
- SoA Value Store implemented (from Plan 001)
- Internal evaluator working with ValueRef
- Persistent store in FormulaRuntime

### Goals
- Eliminate redundant evaluations in cascade updates
- Process formulas in correct dependency order
- Enable parallel execution of independent formulas
- Achieve additional 20-50x improvement over SoA alone

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target Architecture](#2-target-architecture)
3. [Phase 1: Dirty Marking](#3-phase-1-dirty-marking-1-week)
4. [Phase 2: Topological Sort](#4-phase-2-topological-sort-1-week)
5. [Phase 3: Batching](#5-phase-3-batching-1-week)
6. [Phase 4: Persistent Store Integration](#6-phase-4-persistent-store-integration-1-week)
7. [Phase 5: Stabilization](#7-phase-5-stabilization-1-week)
8. [Performance Analysis](#8-performance-analysis)
9. [Risk Mitigation](#9-risk-mitigation)
10. [Success Metrics](#10-success-metrics)

---

## 1. Current State Analysis

### 1.1 Current Processing Flow (After SoA)

```
┌─────────────────────────────────────────────────────────────────┐
│                  Current Runtime Processing                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Node value changes                                          │
│  2. enqueueDependents(nodeId)                                   │
│  3. Add each dependent to RecalculationQueue (Set)              │
│  4. Process queue in FIFO/arbitrary order                       │
│  5. For each formula:                                           │
│     - Build context (now uses ValueRef from SoA)                │
│     - Evaluate (now uses internal SoA evaluator)                │
│     - Store result                                              │
│     - enqueueDependents() for this formula                      │
│  6. Repeat until queue is empty                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Problems with Current Approach

#### Problem 1: Non-Optimal Order

```
Dependency Graph:
  A(depth=0) → B(depth=1) → C(depth=2) → D(depth=3)

Current processing (arbitrary order):
1. D is in queue, processed first
   - Uses OLD value of C (C not yet calculated!)
2. C is processed
   - D is now stale, needs re-processing
3. B is processed
   - C and D are now stale
4. etc.

Result: Multiple redundant evaluations
```

#### Problem 2: Redundant Enqueueing

```
Diamond dependency:
      A
     ╱ ╲
    B   C
     ╲ ╱
      D

When A changes:
1. enqueueDependents(A) → adds B, C
2. Process B → enqueueDependents(B) → adds D
3. Process C → enqueueDependents(C) → adds D (already in queue ✓)
4. Process D (first time)
5. BUT: if B completes before C starts, and D is processed,
        then C finishes, D is added again and processed twice!
```

#### Problem 3: No Parallelism

```
Independent formulas at same depth:
  A → [B1, B2, B3, B4, B5]  (5 independent formulas)

Current: Process B1, B2, B3, B4, B5 sequentially
Optimal: Process all 5 in parallel!
```

### 1.3 Current Implementation Files

| File | Current Role | Changes Needed |
|------|--------------|----------------|
| `runtime.ts` | Queue processing, cascade logic | Major refactoring |
| `recalculation-queue.ts` | Simple Set-based queue | Replace with priority queue |
| `dependency-graph.ts` | Graph structure, depth cache | Add topological sort |
| `executor.ts` | Single formula execution | Add batch execution |

---

## 2. Target Architecture

### 2.1 New Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│            Target: Dirty Marking + Topo Sort + Batching         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Node value changes                                          │
│  2. markDirty(nodeId) - recursive dirty marking                 │
│  3. Schedule batch processing (debounced)                       │
│  4. When processing triggered:                                  │
│     a. Collect all dirty nodes                                  │
│     b. Sort by depth (topological order)                        │
│     c. Group by depth (batches)                                 │
│     d. For each depth level (ascending):                        │
│        - Process entire batch in parallel                       │
│        - All nodes at this depth have dependencies satisfied    │
│        - Update results in persistent store (ValueRef mutation) │
│     e. Clear dirty flags                                        │
│  5. All formulas evaluated exactly once in optimal order        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      FormulaRuntime                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ DirtyTracker │    │  TopoSorter  │    │BatchExecutor │      │
│  │              │ →  │              │ →  │              │      │
│  │ - dirtyNodes │    │ - sortByDep  │    │ - parallel   │      │
│  │ - generation │    │ - groupByDep │    │ - throttling │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         ↑                   ↑                   ↓               │
│         │                   │                   │               │
│  ┌──────┴───────────────────┴───────────────────┴──────┐       │
│  │              DependencyGraph (enhanced)              │       │
│  │                                                      │       │
│  │  - dependencies / dependents (existing)              │       │
│  │  - depthCache (existing)                             │       │
│  │  + topologicalOrder() (new)                          │       │
│  │  + getNodesAtDepth() (new)                           │       │
│  └──────────────────────────────────────────────────────┘       │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────┐       │
│  │           FormulaValueStore (from SoA plan)          │       │
│  │                                                      │       │
│  │  - Persistent store for all results                  │       │
│  │  - ValueRef mutation for updates                     │       │
│  │  - No allocation during incremental updates          │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Data Structures

```typescript
// New interfaces for dirty tracking
interface DirtyState {
  readonly dirtyNodes: Set<string>;
  readonly generation: number;
  readonly lastEvaluated: Map<string, number>;
}

// Enhanced graph capabilities
interface TopologicalSortResult {
  readonly sorted: readonly string[];
  readonly byDepth: ReadonlyMap<number, readonly string[]>;
}

// Batch execution context
interface BatchContext {
  readonly nodeIds: readonly string[];
  readonly depth: number;
  readonly store: FormulaValueStore;
  readonly contexts: ReadonlyMap<string, Map<string, ValueRef>>;
}
```

---

## 3. Phase 1: Dirty Marking (1 week)

### 3.1 Create DirtyTracker Class

**File:** `src/runtime/dirty-tracker.ts`

```typescript
/**
 * Tracks which nodes need recalculation using generation-based dirty marking.
 *
 * Key concepts:
 * - `dirtyNodes`: Set of node IDs that need recalculation
 * - `generation`: Counter that increments each processing cycle
 * - `lastEvaluated`: Maps nodeId → generation when last evaluated
 *
 * A node is considered stale if:
 * - It's in dirtyNodes, OR
 * - Its lastEvaluated < current generation AND any dependency is dirty
 */
export class DirtyTracker {
  readonly #dirtyNodes = new Set<string>();
  readonly #lastEvaluated = new Map<string, number>();
  #generation = 0;

  /**
   * Mark a node and all its transitive dependents as dirty.
   * Uses breadth-first traversal to avoid stack overflow on deep graphs.
   */
  markDirty(nodeId: string, graph: DependencyGraph): void {
    if (this.#dirtyNodes.has(nodeId)) {
      return; // Already marked, avoid redundant work
    }

    // BFS to mark all transitive dependents
    const queue = [nodeId];
    let idx = 0;

    while (idx < queue.length) {
      const current = queue[idx++];

      if (this.#dirtyNodes.has(current)) {
        continue;
      }

      this.#dirtyNodes.add(current);

      // Add all dependents to queue
      const dependents = graph.getDependents(current);
      for (const dep of dependents) {
        if (!this.#dirtyNodes.has(dep)) {
          queue.push(dep);
        }
      }
    }
  }

  /**
   * Mark multiple nodes as dirty (for batch updates).
   */
  markDirtyBatch(nodeIds: Iterable<string>, graph: DependencyGraph): void {
    for (const nodeId of nodeIds) {
      this.markDirty(nodeId, graph);
    }
  }

  /**
   * Get all dirty nodes and start a new processing generation.
   * Returns the nodes that need to be processed.
   */
  collectDirtyNodes(): Set<string> {
    const result = new Set(this.#dirtyNodes);
    this.#dirtyNodes.clear();
    this.#generation++;
    return result;
  }

  /**
   * Check if a node needs evaluation in current generation.
   */
  needsEvaluation(nodeId: string): boolean {
    const lastGen = this.#lastEvaluated.get(nodeId);
    return lastGen === undefined || lastGen < this.#generation;
  }

  /**
   * Mark a node as evaluated in current generation.
   */
  markEvaluated(nodeId: string): void {
    this.#lastEvaluated.set(nodeId, this.#generation);
  }

  /**
   * Get current generation number.
   */
  get generation(): number {
    return this.#generation;
  }

  /**
   * Get count of dirty nodes (for scheduling decisions).
   */
  get dirtyCount(): number {
    return this.#dirtyNodes.size;
  }

  /**
   * Check if there are any dirty nodes.
   */
  get hasDirtyNodes(): boolean {
    return this.#dirtyNodes.size > 0;
  }

  /**
   * Clear all dirty state (for testing/reset).
   */
  clear(): void {
    this.#dirtyNodes.clear();
    this.#lastEvaluated.clear();
    this.#generation = 0;
  }

  /**
   * Remove a node from tracking (when node is deleted).
   */
  removeNode(nodeId: string): void {
    this.#dirtyNodes.delete(nodeId);
    this.#lastEvaluated.delete(nodeId);
  }
}
```

### 3.2 Update FormulaRuntime to Use DirtyTracker

**File:** `src/runtime/runtime.ts` (modified)

```typescript
import { DirtyTracker } from './dirty-tracker';

export class FormulaRuntime<T extends FormulaNode> {
  // Existing fields...
  readonly #graph = new DependencyGraph();
  readonly #store: FormulaValueStore;  // From SoA plan

  // New dirty tracking
  readonly #dirtyTracker = new DirtyTracker();

  /**
   * Mark a node as changed and schedule processing.
   * Replaces the old enqueueDependents() approach.
   */
  markDirty(nodeId: string): void {
    this.#dirtyTracker.markDirty(nodeId, this.#graph);

    // Schedule processing if not already scheduled
    this.#scheduler.scheduleIfIdle(
      async () => this.#processDirtyNodes(),
      { dirtyCount: this.#dirtyTracker.dirtyCount }
    );
  }

  /**
   * @deprecated Use markDirty() instead.
   * Kept for backward compatibility during migration.
   */
  enqueueDependents(nodeId: string): void {
    this.markDirty(nodeId);
  }

  /**
   * Process all dirty nodes.
   * Phase 1: Simple sequential processing with dirty tracking.
   * Will be enhanced in Phase 2 with topological sort.
   */
  async #processDirtyNodes(): Promise<void> {
    if (!this.#dirtyTracker.hasDirtyNodes) {
      return;
    }

    const dirtyNodes = this.#dirtyTracker.collectDirtyNodes();

    for (const nodeId of dirtyNodes) {
      if (this.#dirtyTracker.needsEvaluation(nodeId)) {
        await this.#processNode(nodeId);
        this.#dirtyTracker.markEvaluated(nodeId);
      }
    }
  }

  /**
   * Process a single node (extracted from existing code).
   */
  async #processNode(nodeId: string): Promise<void> {
    const node = this.#nodeProvider(nodeId);
    if (!node || !this.#adapter.shouldProcess(node)) {
      return;
    }

    const cached = this.#cachedState.get(nodeId);
    if (!cached) {
      // Full validation required
      const expression = this.#adapter.toExpression(node);
      if (!expression) return;

      // ... validation and caching logic
    }

    // Build context using SoA (ValueRef)
    const context = this.#buildContextFromCache(nodeId);

    // Evaluate using internal SoA evaluator
    const { result: resultRef } = await this.#executor.execInternal({
      expression: cached.expression,
      context,
      store: this.#store,
    });

    // Update result in persistent store
    this.#cachedResults.set(nodeId, resultRef);

    // Notify adapter
    const publicResult = toPublicValue(this.#store, resultRef);
    this.#adapter.onCalculate(node, publicResult, cached.dependencies);
  }
}
```

### 3.3 Tasks Checklist for Phase 1

- [ ] Create `src/runtime/dirty-tracker.ts`
- [ ] Implement DirtyTracker class
- [ ] Add unit tests for DirtyTracker
- [ ] Update FormulaRuntime to use DirtyTracker
- [ ] Deprecate `enqueueDependents()` method
- [ ] Add `markDirty()` method
- [ ] Update existing tests to use new API
- [ ] Benchmark: verify no regression from current approach

---

## 4. Phase 2: Topological Sort (1 week)

### 4.1 Enhance DependencyGraph with Topological Sort

**File:** `src/runtime/dependency-graph.ts` (modified)

```typescript
export class DependencyGraph {
  // Existing fields...
  readonly #dependencies = new Map<string, Set<string>>();
  readonly #dependents = new Map<string, Set<string>>();
  readonly #depthCache = new Map<string, number>();

  /**
   * Get topologically sorted list of nodes.
   * Nodes are sorted by depth (ascending), so dependencies come before dependents.
   *
   * @param nodes - Set of nodes to sort
   * @returns Sorted array of node IDs
   */
  topologicalSort(nodes: ReadonlySet<string>): string[] {
    if (nodes.size === 0) return [];

    // Calculate depths for all nodes (uses cached depths where available)
    const nodeDepths: Array<{ id: string; depth: number }> = [];

    for (const nodeId of nodes) {
      const depth = this.getNodeDepth(nodeId);
      nodeDepths.push({ id: nodeId, depth });
    }

    // Sort by depth (ascending)
    nodeDepths.sort((a, b) => a.depth - b.depth);

    return nodeDepths.map(n => n.id);
  }

  /**
   * Get topologically sorted nodes grouped by depth level.
   * Nodes at the same depth can be processed in parallel.
   *
   * @param nodes - Set of nodes to sort and group
   * @returns Map of depth → array of node IDs at that depth
   */
  groupByDepth(nodes: ReadonlySet<string>): Map<number, string[]> {
    const result = new Map<number, string[]>();

    for (const nodeId of nodes) {
      const depth = this.getNodeDepth(nodeId);

      if (!result.has(depth)) {
        result.set(depth, []);
      }

      result.get(depth)!.push(nodeId);
    }

    return result;
  }

  /**
   * Get sorted depth levels from a grouped result.
   *
   * @param grouped - Result from groupByDepth()
   * @returns Array of depth levels in ascending order
   */
  getSortedDepthLevels(grouped: Map<number, string[]>): number[] {
    return Array.from(grouped.keys()).sort((a, b) => a - b);
  }

  /**
   * Efficient batch depth calculation.
   * Calculates depths for multiple nodes, sharing cached results.
   *
   * @param nodes - Set of nodes to calculate depths for
   * @returns Map of nodeId → depth
   */
  calculateDepthsBatch(nodes: ReadonlySet<string>): Map<string, number> {
    const result = new Map<string, number>();

    for (const nodeId of nodes) {
      result.set(nodeId, this.getNodeDepth(nodeId));
    }

    return result;
  }
}
```

### 4.2 Create TopoSorter Utility

**File:** `src/runtime/topo-sorter.ts`

```typescript
import type { DependencyGraph } from './dependency-graph';

/**
 * Result of topological sorting.
 */
export interface TopoSortResult {
  /** Flat list of nodes sorted by depth (ascending) */
  readonly sorted: readonly string[];
  /** Nodes grouped by depth level */
  readonly byDepth: ReadonlyMap<number, readonly string[]>;
  /** Sorted depth levels */
  readonly depthLevels: readonly number[];
}

/**
 * Utility class for topological sorting operations.
 */
export class TopoSorter {
  readonly #graph: DependencyGraph;

  constructor(graph: DependencyGraph) {
    this.#graph = graph;
  }

  /**
   * Sort nodes and group by depth for batch processing.
   */
  sortAndGroup(nodes: ReadonlySet<string>): TopoSortResult {
    if (nodes.size === 0) {
      return {
        sorted: [],
        byDepth: new Map(),
        depthLevels: [],
      };
    }

    // Group by depth
    const byDepth = this.#graph.groupByDepth(nodes);

    // Get sorted depth levels
    const depthLevels = this.#graph.getSortedDepthLevels(byDepth);

    // Create flat sorted list
    const sorted: string[] = [];
    for (const depth of depthLevels) {
      const nodesAtDepth = byDepth.get(depth)!;
      sorted.push(...nodesAtDepth);
    }

    return {
      sorted,
      byDepth,
      depthLevels,
    };
  }

  /**
   * Get the maximum depth in a set of nodes.
   */
  getMaxDepth(nodes: ReadonlySet<string>): number {
    let maxDepth = 0;

    for (const nodeId of nodes) {
      const depth = this.#graph.getNodeDepth(nodeId);
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    }

    return maxDepth;
  }

  /**
   * Estimate processing order complexity.
   * Used for scheduling decisions.
   */
  estimateComplexity(nodes: ReadonlySet<string>): {
    nodeCount: number;
    maxDepth: number;
    averageDepth: number;
  } {
    let totalDepth = 0;
    let maxDepth = 0;

    for (const nodeId of nodes) {
      const depth = this.#graph.getNodeDepth(nodeId);
      totalDepth += depth;
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    }

    return {
      nodeCount: nodes.size,
      maxDepth,
      averageDepth: nodes.size > 0 ? totalDepth / nodes.size : 0,
    };
  }
}
```

### 4.3 Update FormulaRuntime with Topological Sort

```typescript
import { TopoSorter } from './topo-sorter';

export class FormulaRuntime<T extends FormulaNode> {
  // Existing fields...
  readonly #topoSorter: TopoSorter;

  constructor(options: FormulaRuntimeOptions<T>) {
    // ... existing initialization
    this.#topoSorter = new TopoSorter(this.#graph);
  }

  /**
   * Process all dirty nodes in topological order.
   * Nodes with lower depth are processed first.
   */
  async #processDirtyNodes(): Promise<void> {
    if (!this.#dirtyTracker.hasDirtyNodes) {
      return;
    }

    const dirtyNodes = this.#dirtyTracker.collectDirtyNodes();

    // Sort by depth (topological order)
    const { sorted, depthLevels } = this.#topoSorter.sortAndGroup(dirtyNodes);

    // Process in order (sequential for now, parallel in Phase 3)
    for (const nodeId of sorted) {
      if (this.#dirtyTracker.needsEvaluation(nodeId)) {
        await this.#processNode(nodeId);
        this.#dirtyTracker.markEvaluated(nodeId);
      }
    }
  }
}
```

### 4.4 Tasks Checklist for Phase 2

- [ ] Add `topologicalSort()` method to DependencyGraph
- [ ] Add `groupByDepth()` method to DependencyGraph
- [ ] Create `src/runtime/topo-sorter.ts`
- [ ] Implement TopoSorter class
- [ ] Update FormulaRuntime to use topological sorting
- [ ] Add unit tests for topological sort
- [ ] Add integration tests for correct ordering
- [ ] Benchmark: verify performance improvement

---

## 5. Phase 3: Batching (1 week)

### 5.1 Create BatchExecutor

**File:** `src/runtime/executor/batch-executor.ts`

```typescript
import type { FormulaValueStore, ValueRef } from '../../core/value-store';
import type { Expression } from '../../core';

export interface BatchItem {
  readonly nodeId: string;
  readonly expression: Expression;
  readonly context: Map<string, ValueRef>;
}

export interface BatchResult {
  readonly nodeId: string;
  readonly resultRef: ValueRef;
  readonly error?: Error;
}

export interface BatchExecutorOptions {
  readonly maxConcurrency: number;
  readonly store: FormulaValueStore;
}

/**
 * Executes multiple formulas in parallel with concurrency control.
 */
export class BatchExecutor {
  readonly #store: FormulaValueStore;
  readonly #maxConcurrency: number;

  constructor(options: BatchExecutorOptions) {
    this.#store = options.store;
    this.#maxConcurrency = options.maxConcurrency;
  }

  /**
   * Execute a batch of formulas in parallel.
   * Uses Promise.allSettled for fault tolerance.
   */
  async executeBatch(items: readonly BatchItem[]): Promise<BatchResult[]> {
    if (items.length === 0) {
      return [];
    }

    // Small batch: execute all at once
    if (items.length <= this.#maxConcurrency) {
      return this.#executeAll(items);
    }

    // Large batch: chunk and process with concurrency limit
    return this.#executeChunked(items);
  }

  /**
   * Execute all items in parallel.
   */
  async #executeAll(items: readonly BatchItem[]): Promise<BatchResult[]> {
    const promises = items.map(item => this.#executeOne(item));
    const results = await Promise.allSettled(promises);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      return {
        nodeId: items[index].nodeId,
        resultRef: this.#store.NULL,
        error: result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason)),
      };
    });
  }

  /**
   * Execute items in chunks with concurrency limit.
   */
  async #executeChunked(items: readonly BatchItem[]): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (let i = 0; i < items.length; i += this.#maxConcurrency) {
      const chunk = items.slice(i, i + this.#maxConcurrency);
      const chunkResults = await this.#executeAll(chunk);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Execute a single formula.
   */
  async #executeOne(item: BatchItem): Promise<BatchResult> {
    try {
      // Use internal SoA evaluator
      const resultRef = item.expression.evaluateInternal({
        context: item.context,
        store: this.#store,
      });

      return {
        nodeId: item.nodeId,
        resultRef,
      };
    } catch (error) {
      return {
        nodeId: item.nodeId,
        resultRef: this.#store.NULL,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
```

### 5.2 Update FormulaRuntime for Batch Processing

```typescript
import { BatchExecutor } from './executor/batch-executor';

export class FormulaRuntime<T extends FormulaNode> {
  readonly #batchExecutor: BatchExecutor;

  constructor(options: FormulaRuntimeOptions<T>) {
    // ... existing initialization

    this.#batchExecutor = new BatchExecutor({
      maxConcurrency: options.maxConcurrency ?? 10,
      store: this.#store,
    });
  }

  /**
   * Process all dirty nodes using batch execution.
   * Nodes at the same depth level are executed in parallel.
   */
  async #processDirtyNodes(): Promise<void> {
    if (!this.#dirtyTracker.hasDirtyNodes) {
      return;
    }

    const dirtyNodes = this.#dirtyTracker.collectDirtyNodes();
    const { byDepth, depthLevels } = this.#topoSorter.sortAndGroup(dirtyNodes);

    // Process each depth level as a batch
    for (const depth of depthLevels) {
      const nodesAtDepth = byDepth.get(depth)!;

      // Build batch items
      const batchItems: BatchItem[] = [];

      for (const nodeId of nodesAtDepth) {
        if (!this.#dirtyTracker.needsEvaluation(nodeId)) {
          continue;
        }

        const cached = this.#cachedState.get(nodeId);
        if (!cached) {
          // Need full validation - handle separately
          await this.#processNodeWithValidation(nodeId);
          this.#dirtyTracker.markEvaluated(nodeId);
          continue;
        }

        // Build context from cached results
        const context = this.#buildContextFromCache(nodeId);

        batchItems.push({
          nodeId,
          expression: cached.expression,
          context,
        });
      }

      // Execute batch in parallel
      if (batchItems.length > 0) {
        const results = await this.#batchExecutor.executeBatch(batchItems);

        // Process results
        for (const result of results) {
          if (result.error) {
            this.#handleNodeError(result.nodeId, result.error);
          } else {
            this.#cachedResults.set(result.nodeId, result.resultRef);
            this.#notifyAdapter(result.nodeId, result.resultRef);
          }

          this.#dirtyTracker.markEvaluated(result.nodeId);
        }
      }
    }
  }

  /**
   * Build context using cached ValueRefs from persistent store.
   */
  #buildContextFromCache(nodeId: string): Map<string, ValueRef> {
    const context = new Map<string, ValueRef>();
    const cached = this.#cachedState.get(nodeId);

    if (!cached) {
      return context;
    }

    for (const depId of cached.dependencies) {
      const cachedRef = this.#cachedResults.get(depId);

      if (cachedRef !== undefined) {
        context.set(depId, cachedRef);
      } else {
        // Fallback: load from node provider
        const dep = this.#nodeProvider(depId);
        if (dep) {
          const value = this.#adapter.toFormulaDataType(dep);
          const ref = toInternalRef(this.#store, value);
          this.#cachedResults.set(depId, ref);
          context.set(depId, ref);
        }
      }
    }

    return context;
  }
}
```

### 5.3 Tasks Checklist for Phase 3

- [ ] Create `src/runtime/executor/batch-executor.ts`
- [ ] Implement BatchExecutor class
- [ ] Add concurrency control
- [ ] Update FormulaRuntime for batch processing
- [ ] Add configuration options for max concurrency
- [ ] Add unit tests for batch executor
- [ ] Add integration tests for parallel execution
- [ ] Benchmark: measure parallelization speedup

---

## 6. Phase 4: Persistent Store Integration (1 week)

### 6.1 Optimize Result Storage

The key optimization is using ValueRef mutations instead of allocations:

```typescript
class FormulaRuntime {
  /**
   * Update a node's result using mutation instead of allocation.
   */
  #updateResult(nodeId: string, newResultRef: ValueRef): void {
    const existingRef = this.#cachedResults.get(nodeId);

    if (existingRef !== undefined) {
      // Copy value from new ref to existing ref (mutation)
      this.#store.copyValue(newResultRef, existingRef);

      // The new ref can be discarded (or reused in arena)
    } else {
      // First time: store the ref
      this.#cachedResults.set(nodeId, newResultRef);
    }
  }
}

// Add copyValue to FormulaValueStore
class FormulaValueStore {
  /**
   * Copy value from source ref to target ref.
   * Used to update existing refs without allocation.
   */
  copyValue(sourceRef: ValueRef, targetRef: ValueRef): void {
    const kind = this.kinds[sourceRef];
    this.kinds[targetRef] = kind;

    switch (kind) {
      case Kind.Null:
        break;
      case Kind.Boolean:
        this.booleans[targetRef] = this.booleans[sourceRef];
        break;
      case Kind.Number:
        this.numbers[targetRef] = this.numbers[sourceRef];
        break;
      case Kind.String:
        this.stringIndices[targetRef] = this.stringIndices[sourceRef];
        break;
      case Kind.Date:
        this.timestamps[targetRef] = this.timestamps[sourceRef];
        break;
      case Kind.Duration:
        this.durations[targetRef] = this.durations[sourceRef];
        break;
      case Kind.Array:
      case Kind.Object:
      case Kind.RegExp:
        this.complexIndices[targetRef] = this.complexIndices[sourceRef];
        break;
    }
  }
}
```

### 6.2 Arena Allocation for Evaluation

```typescript
class FormulaRuntime {
  /**
   * Process dirty nodes with arena allocation.
   * Temporary values from evaluation are released after each batch.
   */
  async #processDirtyNodes(): Promise<void> {
    // ... collect and sort dirty nodes

    for (const depth of depthLevels) {
      const nodesAtDepth = byDepth.get(depth)!;

      // Mark arena position before batch
      const mark = this.#store.mark();

      try {
        const batchItems = this.#prepareBatchItems(nodesAtDepth);
        const results = await this.#batchExecutor.executeBatch(batchItems);

        // Copy results to persistent refs (outside arena)
        for (const result of results) {
          if (!result.error) {
            this.#updateResult(result.nodeId, result.resultRef);
          }
        }
      } finally {
        // Release arena memory back to mark
        this.#store.releaseTo(mark);
      }
    }
  }
}
```

### 6.3 Tasks Checklist for Phase 4

- [ ] Add `copyValue()` method to FormulaValueStore
- [ ] Implement arena allocation with mark/release
- [ ] Update result storage to use mutations
- [ ] Add memory usage tracking
- [ ] Verify no memory leaks
- [ ] Benchmark: measure memory efficiency

---

## 7. Phase 5: Stabilization (1 week)

### 7.1 Error Handling

```typescript
class FormulaRuntime {
  /**
   * Handle errors during batch processing.
   */
  #handleBatchErrors(results: BatchResult[]): void {
    for (const result of results) {
      if (result.error) {
        const node = this.#nodeProvider(result.nodeId);
        if (node) {
          this.#adapter.onError(node, result.error);
        }

        // Clear cached state for failed nodes
        this.#cachedState.delete(result.nodeId);
        this.#cachedResults.delete(result.nodeId);
      }
    }
  }

  /**
   * Retry failed nodes (optional).
   */
  async #retryFailedNodes(failedIds: string[]): Promise<void> {
    for (const nodeId of failedIds) {
      this.#dirtyTracker.markDirty(nodeId, this.#graph);
    }

    // Schedule retry
    this.#scheduler.scheduleIfIdle(
      () => this.#processDirtyNodes(),
      { isRetry: true }
    );
  }
}
```

### 7.2 Debugging and Monitoring

```typescript
interface ProcessingMetrics {
  totalNodes: number;
  depthLevels: number;
  batchesExecuted: number;
  parallelFactor: number;
  processingTimeMs: number;
  errorsCount: number;
}

class FormulaRuntime {
  #lastMetrics?: ProcessingMetrics;

  async #processDirtyNodes(): Promise<void> {
    const startTime = performance.now();
    let batchesExecuted = 0;
    let errorsCount = 0;

    // ... processing logic

    for (const depth of depthLevels) {
      const results = await this.#batchExecutor.executeBatch(batchItems);
      batchesExecuted++;
      errorsCount += results.filter(r => r.error).length;
    }

    this.#lastMetrics = {
      totalNodes: dirtyNodes.size,
      depthLevels: depthLevels.length,
      batchesExecuted,
      parallelFactor: dirtyNodes.size / batchesExecuted,
      processingTimeMs: performance.now() - startTime,
      errorsCount,
    };

    FormulaDebugger.traceMetrics(this.#lastMetrics);
  }

  getLastMetrics(): ProcessingMetrics | undefined {
    return this.#lastMetrics;
  }
}
```

### 7.3 Tasks Checklist for Phase 5

- [ ] Implement comprehensive error handling
- [ ] Add retry logic for transient failures
- [ ] Add processing metrics collection
- [ ] Update FormulaDebugger for new flow
- [ ] Documentation updates
- [ ] Performance regression tests
- [ ] Memory leak tests
- [ ] Stress tests with large graphs

---

## 8. Performance Analysis

### 8.1 Theoretical Improvement

```
Scenario: Spreadsheet with 1000 formulas, diamond dependencies
Single cell change → cascade update to 200 formulas

┌─────────────────────────────────────────────────────────────────┐
│           Baseline: Current SoA (without this plan)             │
├─────────────────────────────────────────────────────────────────┤
│ - Processing order: arbitrary                                   │
│ - Redundant evaluations: ~40 (20% of cascade)                   │
│ - Parallel execution: none                                      │
│ - Per-formula time: 185ns (from SoA)                            │
│ ──────────────────────────────────────────────────────────────  │
│ Total: (200 + 40) × 185ns = 44,400ns = 0.044ms                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│        After Phase 1: Dirty Marking (no topo sort yet)          │
├─────────────────────────────────────────────────────────────────┤
│ - Processing order: still arbitrary                             │
│ - Redundant evaluations: ~20 (10% - generation tracking)        │
│ - Parallel execution: none                                      │
│ - Per-formula time: 185ns                                       │
│ ──────────────────────────────────────────────────────────────  │
│ Total: (200 + 20) × 185ns = 40,700ns = 0.041ms                  │
│ Improvement: 8%                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│          After Phase 2: + Topological Sort                      │
├─────────────────────────────────────────────────────────────────┤
│ - Processing order: optimal (by depth)                          │
│ - Redundant evaluations: 0 ✅                                   │
│ - Parallel execution: none                                      │
│ - Per-formula time: 185ns                                       │
│ ──────────────────────────────────────────────────────────────  │
│ Total: 200 × 185ns = 37,000ns = 0.037ms                         │
│ Improvement: 17%                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│           After Phase 3: + Batching (parallel)                  │
├─────────────────────────────────────────────────────────────────┤
│ - Processing order: optimal                                     │
│ - Redundant evaluations: 0                                      │
│ - Parallel execution: yes (10 concurrent)                       │
│ - Depth levels: ~5 (avg 40 formulas per level)                  │
│ - Per-batch time: 4 × 185ns = 740ns (parallelism)               │
│ ──────────────────────────────────────────────────────────────  │
│ Total: 5 batches × 4 rounds × 185ns = 3,700ns = 0.004ms         │
│ Improvement: 91%                                                 │
│                                                                  │
│ 🚀 Speedup vs baseline: 12x                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│      After Phase 4: + Persistent Store (no temp allocations)    │
├─────────────────────────────────────────────────────────────────┤
│ - All optimizations from Phase 3                                │
│ - Context building: reuse cached ValueRefs                      │
│ - Result storage: mutation instead of allocation                │
│ - Arena allocation for temps                                    │
│ - Per-formula time: 100ns (reduced from 185ns)                  │
│ ──────────────────────────────────────────────────────────────  │
│ Total: 5 batches × 4 rounds × 100ns = 2,000ns = 0.002ms         │
│                                                                  │
│ 🚀 Speedup vs baseline: 22x                                     │
│ 🚀 Speedup vs original AoS: 5000x                               │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Benchmark Suite

```typescript
// benchmark/dirty-marking.bench.ts

describe('Dirty Marking + Topo Sort Benchmarks', () => {
  bench('Linear chain: 100 formulas', async () => {
    // A → B → C → ... → Z (100 levels)
    const orchestrator = createLinearChain(100);
    orchestrator.updateNode('A', 42);
    await orchestrator.waitForProcessing();
  });

  bench('Diamond: 1000 formulas', async () => {
    // Wide diamond with multiple paths
    const orchestrator = createDiamond(1000);
    orchestrator.updateNode('root', 42);
    await orchestrator.waitForProcessing();
  });

  bench('Spreadsheet: 10000 cells', async () => {
    // 100 rows × 100 columns with realistic dependencies
    const orchestrator = createSpreadsheet(100, 100);
    orchestrator.updateNode('A1', 42);
    await orchestrator.waitForProcessing();
  });

  bench('Parallel: 1000 independent formulas', async () => {
    // All formulas depend only on A
    const orchestrator = createStarGraph(1000);
    orchestrator.updateNode('center', 42);
    await orchestrator.waitForProcessing();
  });
});
```

---

## 9. Risk Mitigation

### 9.1 Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Incorrect topological order | Low | High | Extensive testing, formal verification |
| Race conditions in parallel execution | Medium | High | Careful synchronization, stress testing |
| Memory pressure from large batches | Medium | Medium | Chunking, concurrency limits |
| Compatibility with existing scheduler | Low | Medium | Adapter pattern, gradual migration |

### 9.2 Feature Flags

```typescript
interface RuntimeFeatureFlags {
  useDirtyMarking: boolean;      // Phase 1
  useTopologicalSort: boolean;   // Phase 2
  useBatchExecution: boolean;    // Phase 3
  usePersistentStore: boolean;   // Phase 4
  maxConcurrency: number;
}

const DEFAULT_FLAGS: RuntimeFeatureFlags = {
  useDirtyMarking: true,
  useTopologicalSort: true,
  useBatchExecution: true,
  usePersistentStore: true,
  maxConcurrency: 10,
};
```

### 9.3 Gradual Rollout

```
Week 1: Phase 1 (Dirty Marking) - 10% of traffic
Week 2: Phase 1 - 100%, Phase 2 (Topo Sort) - 10%
Week 3: Phase 2 - 100%, Phase 3 (Batching) - 10%
Week 4: Phase 3 - 100%, Phase 4 (Persistent Store) - 10%
Week 5: Phase 4 - 100%
```

---

## 10. Success Metrics

### 10.1 Performance Targets

| Metric | Baseline (SoA only) | Target | Measurement |
|--------|---------------------|--------|-------------|
| Redundant evaluations | 20% | 0% | Counter |
| 200-formula cascade | 0.044ms | 0.002ms | Benchmark |
| Parallel speedup (1000 independent) | 1x | 8-10x | Benchmark |
| Memory per cascade | O(n) allocs | O(1) allocs | Heap snapshot |

### 10.2 Quality Targets

| Metric | Target |
|--------|--------|
| Test coverage | >95% |
| Zero regressions | All existing tests pass |
| Correct ordering | Formal verification of topo sort |
| No race conditions | Stress test passes |

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Dirty Marking | 1 week | DirtyTracker, generation tracking |
| Phase 2: Topological Sort | 1 week | TopoSorter, optimal ordering |
| Phase 3: Batching | 1 week | BatchExecutor, parallel execution |
| Phase 4: Persistent Store | 1 week | Mutations, arena allocation |
| Phase 5: Stabilization | 1 week | Error handling, monitoring |
| **Total** | **5 weeks** | Full optimization |

---

## Dependencies

This plan requires:
- ✅ SoA migration complete (Plan 001)
- ✅ FormulaValueStore with persistent storage
- ✅ Internal evaluator using ValueRef
- ✅ toInternalRef/toPublicValue converters

---

## File Structure After Migration

```
src/runtime/
├── dirty-tracker.ts           # NEW: Dirty marking logic
├── topo-sorter.ts             # NEW: Topological sorting
├── dependency-graph.ts        # MODIFIED: Added groupByDepth
├── runtime.ts                 # MODIFIED: New processing flow
├── executor/
│   ├── batch-executor.ts      # NEW: Parallel batch execution
│   ├── executor.ts            # MODIFIED: SoA support
│   └── ...
└── __tests__/
    ├── dirty-tracker.test.ts  # NEW
    ├── topo-sorter.test.ts    # NEW
    ├── batch-executor.test.ts # NEW
    └── ...
```
