import type { ValueFormat } from '../core';
import type { Executor } from './executor';
import type { Scheduler } from './scheduler';
import type { FormulaNode, NodeAdapter } from './types';

import { Errors } from '../core/errors';
import { validateValueFormat } from '../core/value-format';
import { SyncExecutor } from './executor';
import { FormulaRuntime } from './runtime';
import { ImmediateScheduler } from './scheduler';

export interface FormulaOrchestratorOptions<T extends FormulaNode> {
  adapter: NodeAdapter<T>;
  executor?: Executor;
  scheduler?: Scheduler;
  /**
   * How values look when a formula turns them into text.
   *
   * @remarks
   * Fixed for the life of the orchestrator: to switch to another language, create a new orchestrator.
   */
  format?: ValueFormat;
}

/**
 * High-level orchestrator for formula system.
 * Coordinates the runtime, registry, and subscriptions.
 *
 * This class provides a simplified API for managing nodes in the formula system,
 * handling all the complexity of coordinating multiple components.
 *
 * ## Responsibilities:
 * - Owns and manages the node registry
 * - Manages node subscriptions and lifecycle
 * - Delegates all formula processing and graph management to FormulaRuntime
 * - Provides high-level API for enqueuing operations
 *
 * ## Architecture Flow:
 * 1. Nodes are added to the registry
 * 2. Formula nodes are automatically enqueued for processing
 * 3. When dependencies change, dependent formulas are re-enqueued
 * 4. The runtime processes the queue, evaluating formulas in correct order
 * 5. Results are applied back to nodes, triggering subscriptions
 *
 * @template T - Node type, must have an 'id' property
 *
 * @example
 * Basic usage:
 * ```typescript
 * const orchestrator = new FormulaOrchestrator({
 *   adapter: {
 *     shouldProcess: (node) => node instanceof FormulaNode,
 *     toFormulaDataType: (node) => node.toFormulaValue(),
 *     toFormulaString: (node) => node.formula,
 *     applyResult: (node, value, deps) => node.setValue(value),
 *     fallback: (node, error) => node.setError(error)
 *   },
 *   executor: new SyncExecutor()
 * });
 *
 * // Add nodes
 * orchestrator.add(node1);
 * orchestrator.add(formulaNode, (node) => {
 *   // Subscribe to changes
 *   return node.onChange(() => console.log('Formula updated'));
 * });
 *
 * // Trigger recalculation of dependents
 * orchestrator.enqueueDependents('node1');
 * ```
 */
export class FormulaOrchestrator<T extends FormulaNode> {
  readonly #adapter: NodeAdapter<T>;
  readonly #registry = new Map<string, T>();
  readonly #runtime: FormulaRuntime<T>;
  readonly #subscriptions = new Map<string, () => void>();

  /** @throws {TypeError} When a list of names in `format` holds a different number of names than its token needs. */
  constructor(options: FormulaOrchestratorOptions<T>) {
    validateValueFormat(options.format);

    this.#adapter = options.adapter;
    this.#runtime = new FormulaRuntime({
      adapter: this.#adapter,
      nodeProvider: (id) => this.#registry.get(id),
      executor: options.executor ?? new SyncExecutor(),
      scheduler: options.scheduler ?? new ImmediateScheduler(),
      format: options.format,
      onNodeCleanup: (id) => {
        this.#registry.delete(id);
      },
    });
  }

  /**
   * Adds a node to the formula system.
   * Handles registration, subscription setup, and initial processing.
   *
   * @param node - The node to add
   * @param subscribe - Optional callback to subscribe to node changes
   * @throws FormulaError coded `DUPLICATE_NODE_ID` if a node with the same ID already exists
   * @throws FormulaError coded `MAX_FORMULAS_EXCEEDED` if the node holds a formula and the formula limit is reached
   */
  add(node: T, subscribe?: () => () => void): void {
    // Validate uniqueness
    if (this.#registry.has(node.id)) {
      throw Errors.Runtime.DuplicateNodeId.create({ nodeId: node.id });
    }

    // Take a slot of the formulas count limit before the node is registered, so a refused node leaves no trace
    if (this.#adapter.shouldProcess(node)) {
      this.#runtime.admitFormula(node.id);
    }

    // Add to registry first
    this.#registry.set(node.id, node);

    // Register with runtime for GC
    this.#runtime.register(node.id, node);

    // Set up subscription if provided
    if (subscribe) {
      const unsubscribe = subscribe();
      this.#subscriptions.set(node.id, unsubscribe);
    }

    // Enqueue if it's a formula
    if (this.#adapter.shouldProcess(node)) {
      this.#runtime.enqueue(node.id);
    }
  }

  /**
   * Removes a node from the formula system.
   * Handles cleanup of subscriptions, graph relationships, and registry.
   *
   * @param id - The ID of the node to remove
   * @returns true if the node was found and removed
   */
  remove(id: string): boolean {
    const node = this.#registry.get(id);

    if (!node) {
      return false;
    }

    // Clean up subscription
    const unsubscribe = this.#subscriptions.get(id);

    if (unsubscribe) {
      unsubscribe();
      this.#subscriptions.delete(id);
    }

    // Unregister from runtime
    this.#runtime.unregister(node);

    // Remove from registry
    this.#registry.delete(id);

    return true;
  }

  /**
   * Gets a node by ID.
   */
  get(id: string): T | undefined {
    return this.#registry.get(id);
  }

  /**
   * Checks if a node exists.
   */
  has(id: string): boolean {
    return this.#registry.has(id);
  }

  /**
   * Enqueues a node for processing.
   * Useful for triggering recalculation of formulas.
   */
  enqueue(id: string): void {
    this.#runtime.enqueue(id);
  }

  /**
   * Enqueues all dependents of a node.
   * Useful when a non-formula property changes.
   */
  enqueueDependents(id: string): void {
    this.#runtime.enqueueDependents(id);
  }

  /**
   * Waits for all pending processing to complete.
   */
  async waitForProcessing(): Promise<void> {
    return this.#runtime.waitForProcessing();
  }

  /**
   * Gets all registered node IDs.
   */
  getAllIds(): string[] {
    return Array.from(this.#registry.keys());
  }
}
