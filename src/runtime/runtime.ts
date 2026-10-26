import type { Expression, FormulaDataType, ValueFormat } from '../core';
import type { Executor } from './executor';
import type { Scheduler } from './scheduler';
import type { FormulaNode, NodeAdapter } from './types';

import { FormulaDebugger } from '../core';
import { isVolatileFormula } from '../core/volatile-formula';
import { DependencyGraph } from './dependency-graph';
import { FormulaValidator } from './formula-validator';
import { isSameValue } from './is-same-value';
import { RecalculationQueue } from './recalculation-queue';

/**
 * Configuration options for FormulaRuntime.
 */
export interface FormulaRuntimeOptions<T extends FormulaNode> {
  executor: Executor;
  scheduler: Scheduler;
  adapter: NodeAdapter<T>;
  nodeProvider: (id: string) => T | undefined;
  onNodeCleanup?: (id: string) => void;
  /** How values look when a formula turns them into text. */
  format?: ValueFormat;
}

/**
 * Cached state for incremental updates.
 * Stores validated formula data to skip re-validation on recalculation.
 */
interface CachedFormulaState {
  /** The formula string when last validated */
  readonly formulaString: string;
  /** Cached dependencies from last validation */
  readonly dependencies: ReadonlySet<string>;
  /** Cached expression object */
  readonly expression: Expression;
  /** Input values of the last evaluation, mutated in place to avoid allocations */
  readonly context: Map<string, FormulaDataType>;
  /** Result of the last successful evaluation; absent after a failure */
  lastResult?: FormulaDataType;
}

/** A formula ready to evaluate, with the cached state its result is recorded in. */
interface ProcessingContext<T> {
  readonly node: T;
  readonly expression: Expression;
  readonly context: Map<string, FormulaDataType>;
  readonly state: CachedFormulaState;
}

/**
 * FormulaRuntime is the core engine that processes formula evaluation and dependency management.
 *
 * It coordinates:
 * - Queue processing for formula evaluation
 * - Dependency graph management and ownership
 * - Cascading updates when dependencies change
 * - Batch processing with scheduling
 * - Memory management via FinalizationRegistry
 *
 * ## Key Design:
 * - Owns the dependency graph and manages all graph operations
 * - Does not own nodes - accesses them via `nodeProvider` callback
 * - Handles graph cleanup automatically via FinalizationRegistry
 * - Delegates node registry cleanup via `onNodeCleanup` callback
 * - Focuses purely on formula processing and dependency management
 *
 * ## Processing Flow:
 * 1. Formulas are enqueued when dependencies change
 * 2. Scheduler batches processing for performance
 * 3. Each formula is evaluated with its dependencies as context
 * 4. Results trigger cascade updates for dependent formulas
 * 5. Process repeats until queue is empty
 *
 * Work whose outcome is already known is skipped: an update repeating the value dependents already hold,
 * a formula whose inputs did not change, and the dependents of a formula whose result did not change.
 * Formulas calling a volatile routine, such as `now()`, are recalculated anyway.
 *
 * @example
 * Internal usage (typically through FormulaOrchestrator):
 * ```typescript
 * const runtime = new FormulaRuntime({
 *   executor: new SyncExecutor(),
 *   scheduler: new BatchingScheduler({ delay: 8 }), // 120fps
 *   adapter: myAdapter,
 *   nodeProvider: (id) => registry.get(id),
 *   onNodeCleanup: (id) => {
 *     // Handle registry cleanup when node is deleted
 *     registry.delete(id);
 *   }
 * });
 *
 * // Register node for GC cleanup
 * runtime.register(node.id, node);
 *
 * // Enqueue for processing
 * runtime.enqueue(node.id);
 *
 * // Enqueue all dependents
 * runtime.enqueueDependents(node.id);
 *
 * // Wait for all processing to complete
 * await runtime.waitForProcessing();
 * ```
 */
export class FormulaRuntime<T extends FormulaNode> {
  readonly #executor: Executor;
  readonly #scheduler: Scheduler;
  readonly #adapter: NodeAdapter<T>;
  readonly #nodeProvider: (id: string) => T | undefined;
  readonly #format?: ValueFormat;
  readonly #graph = new DependencyGraph();
  readonly #queue = new RecalculationQueue((id) => this.#graph.getNodeDepth(id));
  readonly #validator = new FormulaValidator();
  // Track objects for GC-based cleanup
  readonly #finalizer: FinalizationRegistry<string>;
  // Cache for incremental updates - stores validated formula state by node ID
  readonly #cachedState = new Map<string, CachedFormulaState>();
  // Formulas calling a volatile routine: unchanged inputs do not mean an unchanged result
  readonly #volatileNodes = new Set<string>();
  // The value every dependent of a node was last given; absent once dependents may hold different values
  readonly #deliveredValues = new Map<string, FormulaDataType>();
  // Formulas whose last evaluation failed: an update must retry them even when it repeats a value
  readonly #failedNodes = new Set<string>();

  constructor(options: FormulaRuntimeOptions<T>) {
    this.#nodeProvider = options.nodeProvider;
    this.#adapter = options.adapter;
    this.#executor = options.executor;
    this.#scheduler = options.scheduler;
    this.#format = options.format;
    this.#finalizer = new FinalizationRegistry<string>((id) => {
      this.#forget(id);
      options.onNodeCleanup?.(id);
    });
  }

  /**
   * Enqueues a formula node for calculation and schedules processing.
   *
   * @remarks
   * A formula whose text and input values are the same as at its last successful calculation keeps its result
   * without being evaluated again, unless it calls a volatile routine.
   */
  enqueue(nodeId: string): void {
    this.#queue.enqueue(nodeId);
    FormulaDebugger.traceEnqueue(nodeId, 'Manual enqueue');
    this.#scheduleProcessing();
  }

  /**
   * Enqueues every formula that reads the node and schedules processing.
   *
   * @remarks
   * When the node's value is the one its dependents already hold, only the dependents calling a volatile routine
   * are recalculated.
   */
  enqueueDependents(id: string): void {
    const dependents = this.#graph.getDependents(id);
    if (dependents.size === 0) {
      return;
    }

    if (this.#isDeliveredValue(id, dependents)) {
      this.#enqueueVolatile(dependents);
    }
    else {
      for (const dependentId of dependents) {
        this.#queue.enqueue(dependentId);
        FormulaDebugger.traceEnqueue(dependentId, `Cascade from ${id}`);
      }
    }

    this.#scheduleProcessing();
  }

  /**
   * Waits for all currently scheduled processing to complete.
   * Returns immediately if no processing is scheduled.
   */
  async waitForProcessing(): Promise<void> {
    const promise = this.#scheduler.getProcessingPromise();

    if (promise) {
      await promise;
    }
  }

  /**
   * Registers an object so that when it is garbage-collected, runtime cleans up graph & registry.
   * Library users call this via PropertyManager; implementation detail hidden.
   */
  register(nodeId: string, target: object): void {
    this.#finalizer.register(target, nodeId);
  }

  /**
   * Explicitly removes registration of an object if it was removed manually.
   */
  unregister(target: FormulaNode): void {
    this.#finalizer.unregister(target);
    this.#forget(target.id);
  }

  /**
   * Drops everything the runtime keeps for a node that is gone and recalculates the formulas reading it.
   *
   * @remarks
   * The readers keep their edges to the id, as formulas naming a node that never existed do,
   * so a node added again under that id reaches them.
   */
  #forget(id: string): void {
    for (const dependentId of this.#graph.getDependents(id)) {
      this.#queue.enqueue(dependentId);
    }

    this.#graph.replaceDependencies(id, new Set());
    this.#cachedState.delete(id);
    this.#volatileNodes.delete(id);
    this.#deliveredValues.delete(id);
    this.#failedNodes.delete(id);

    this.#scheduleProcessing();
  }

  /**
   * Tells whether every dependent already holds the node's current value, and records the value as delivered.
   */
  #isDeliveredValue(id: string, dependents: ReadonlySet<string>): boolean {
    const node = this.#nodeProvider(id);
    if (!node) {
      this.#deliveredValues.delete(id);
      return false;
    }

    const value = this.#adapter.toFormulaDataType(node);
    const delivered = this.#deliveredValues.get(id);
    this.#deliveredValues.set(id, value);

    if (delivered === undefined || !isSameValue(delivered, value)) {
      return false;
    }

    for (const dependentId of dependents) {
      if (this.#failedNodes.has(dependentId)) {
        return false;
      }
    }

    return true;
  }

  #enqueueVolatile(dependents: ReadonlySet<string>): void {
    if (this.#volatileNodes.size === 0) {
      return;
    }

    for (const dependentId of dependents) {
      if (this.#volatileNodes.has(dependentId)) {
        this.#queue.enqueue(dependentId);
      }
    }
  }

  /**
   * Processes the queue until it is empty.
   *
   * @remarks
   * A synchronous executor processes the whole batch without awaiting between formulas;
   * only an executor that returns a promise is awaited.
   */
  async #processQueue(): Promise<void> {
    this.#scheduler.markProcessingStarted();

    try {
      // Synchronous enqueues from the same tick join this batch
      await Promise.resolve();

      let nodeId = this.#queue.dequeue();
      while (nodeId !== undefined) {
        const pending = this.#processQueueItem(nodeId);
        if (pending) {
          await pending;
        }

        nodeId = this.#queue.dequeue();
      }
    }
    catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[FormulaRuntime] Global processing error:', err);
      throw err;
    }
    finally {
      this.#scheduler.markProcessingComplete();
      // Check if more items were added during processing and schedule if needed
      this.#scheduleProcessing();
    }
  }

  /**
   * Process individual queue item with comprehensive error handling.
   *
   * @returns A promise only when the executor works asynchronously.
   */
  #processQueueItem(nodeId: string): Promise<void> | undefined {
    try {
      const processing = this.#extractAndValidateNode(nodeId);
      if (!processing) {
        return;
      }

      const output = this.#executor.exec({
        expression: processing.expression,
        context: processing.context,
        format: this.#format,
      });

      if (output instanceof Promise) {
        return output.then(
          ({ result, dependencies }) => this.#applyResult(nodeId, processing, result, dependencies),
          (error: unknown) => this.#handleItemError(nodeId, error),
        );
      }

      this.#applyResult(nodeId, processing, output.result, output.dependencies);
    }
    catch (error) {
      this.#handleItemError(nodeId, error);
    }
  }

  /**
   * Hands the result to the host and enqueues the dependents, or only the volatile ones when the result did not change.
   */
  #applyResult(
    nodeId: string,
    { node, state }: ProcessingContext<T>,
    result: FormulaDataType,
    dependencies: ReadonlySet<string>,
  ): void {
    try {
      const unchanged = state.lastResult !== undefined && isSameValue(state.lastResult, result);
      state.lastResult = result;
      this.#failedNodes.delete(nodeId);

      this.#adapter.onCalculate(node, result, dependencies);

      const dependents = this.#graph.getDependents(nodeId);

      if (unchanged) {
        this.#enqueueVolatile(dependents);
        return;
      }

      for (const dependentId of dependents) {
        this.#queue.enqueue(dependentId);
        FormulaDebugger.traceEnqueue(dependentId, `Cascade from ${nodeId}`);
      }
    }
    catch (error) {
      this.#handleItemError(nodeId, error);
    }
  }

  #handleItemError(nodeId: string, error: unknown): void {
    this.#failedNodes.add(nodeId);

    const state = this.#cachedState.get(nodeId);
    if (state) {
      state.lastResult = undefined;
    }

    const node = this.#nodeProvider(nodeId);
    if (!node) {
      return;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    FormulaDebugger.traceError(nodeId, err);

    this.#adapter.onError(node, err);
  }

  /**
   * Extract and validate node for processing.
   * Uses incremental updates when formula hasn't changed (only values changed).
   *
   * @returns `null` when there is nothing to evaluate, including a formula whose inputs did not change.
   */
  #extractAndValidateNode(nodeId: string): ProcessingContext<T> | null {
    const node = this.#nodeProvider(nodeId);
    const expression = node && this.#adapter.shouldProcess(node) ? this.#adapter.toExpression(node) : null;
    if (!node || !expression) {
      return null;
    }

    const currentFormulaString = expression.formula;

    // Check if we can use cached state (incremental update path)
    const cached = this.#cachedState.get(nodeId);
    if (cached && cached.formulaString === currentFormulaString) {
      // Fast path: formula unchanged, only values changed
      FormulaDebugger.traceProcessing(nodeId, cached.expression);

      const inputsChanged = this.#updateExecutionContextInPlace(cached.dependencies, cached.context);

      if (!inputsChanged && cached.lastResult !== undefined && !this.#volatileNodes.has(nodeId)) {
        return null;
      }

      return { node, expression: cached.expression, context: cached.context, state: cached };
    }

    // Slow path: formula is new or changed, full validation required
    return this.#fullValidateAndCache(nodeId, node, expression);
  }

  /**
   * Full validation path for new or changed formulas.
   * Validates, updates graph, and caches state for future incremental updates.
   */
  #fullValidateAndCache(nodeId: string, node: T, expression: Expression): ProcessingContext<T> {
    const formulaValidation = this.#validator.validateFormula(expression);
    if (!formulaValidation.isValid) {
      // Clear cache on validation failure
      this.#cachedState.delete(nodeId);
      throw formulaValidation.error;
    }

    FormulaDebugger.traceProcessing(nodeId, expression);

    // Extract static dependencies
    const staticDeps = expression.extractDependencies();

    // Update dependency graph
    this.#graph.replaceDependencies(nodeId, staticDeps);

    if (isVolatileFormula(expression)) {
      this.#volatileNodes.add(nodeId);
    }
    else {
      this.#volatileNodes.delete(nodeId);
    }

    // Build execution context - use Map for performance
    const context = this.#buildExecutionContext(staticDeps);

    // Cache validated state for future incremental updates (with reusable context objects)
    const state: CachedFormulaState = {
      formulaString: expression.formula,
      dependencies: staticDeps,
      expression,
      context,
    };
    this.#cachedState.set(nodeId, state);

    return { node, expression, context, state };
  }

  /**
   * Build execution context from dependencies.
   */
  #buildExecutionContext(dependencies: ReadonlySet<string>): Map<string, FormulaDataType> {
    const context = new Map<string, FormulaDataType>();

    for (const depId of dependencies) {
      const dep = this.#nodeProvider(depId);

      if (dep) {
        const value = this.#adapter.toFormulaDataType(dep);
        this.#forgetDeliveredIfDiffers(depId, value);
        context.set(depId, value);
      }
    }

    return context;
  }

  /**
   * Update execution context values in place (no allocations).
   * Used for incremental updates when formula hasn't changed.
   *
   * @returns Whether any input value differs from the one the formula was last evaluated with.
   */
  #updateExecutionContextInPlace(
    dependencies: ReadonlySet<string>,
    context: Map<string, FormulaDataType>,
  ): boolean {
    let changed = false;

    for (const depId of dependencies) {
      const dep = this.#nodeProvider(depId);

      if (dep) {
        const value = this.#adapter.toFormulaDataType(dep);
        const previous = context.get(depId);

        if (previous === undefined || !isSameValue(previous, value)) {
          changed = true;
          this.#forgetDeliveredIfDiffers(depId, value);
        }

        context.set(depId, value);
      }
      // An input that is gone leaves the context, so the formula fails on the reference instead of reusing its value
      else if (context.delete(depId)) {
        changed = true;
      }
    }

    return changed;
  }

  // A formula read a value other than the delivered one, so the dependents no longer agree on it
  #forgetDeliveredIfDiffers(depId: string, value: FormulaDataType): void {
    const delivered = this.#deliveredValues.get(depId);

    if (delivered !== undefined && !isSameValue(delivered, value)) {
      this.#deliveredValues.delete(depId);
    }
  }

  #scheduleProcessing(): void {
    if (this.#queue.size() > 0) {
      this.#scheduler.scheduleIfIdle(
        async () => this.#processQueue(),
        { queueSize: this.#queue.size() },
      );
    }
  }
}
