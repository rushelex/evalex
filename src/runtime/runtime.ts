import type { Expression, FormulaDataType } from '../core';
import type { Executor } from './executor';
import type { Scheduler } from './scheduler';
import type { FormulaNode, NodeAdapter } from './types';

import { FormulaDebugger } from '../core';
import { DependencyGraph } from './dependency-graph';
import { FormulaValidator } from './formula-validator';
import { QueueProcessor } from './queue-processor';
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
  private readonly executor: Executor;

  private readonly scheduler: Scheduler;

  private readonly adapter: NodeAdapter<T>;

  private readonly nodeProvider: (id: string) => T | undefined;

  private readonly queue = new RecalculationQueue();

  private readonly graph = new DependencyGraph();

  private readonly validator = new FormulaValidator();

  // Track objects for GC-based cleanup
  private readonly finalizer: FinalizationRegistry<string>;

  constructor(options: FormulaRuntimeOptions<T>) {
    this.nodeProvider = options.nodeProvider;
    this.adapter = options.adapter;
    this.executor = options.executor;
    this.scheduler = options.scheduler;
    this.finalizer = new FinalizationRegistry<string>((id) => {
      this.graph.removeAll(id);
      options.onNodeCleanup?.(id);
    });
  }

  /**
   * Enqueue nodeId for processing and schedule batch if needed.
   */
  public enqueue(nodeId: string): void {
    this.queue.enqueue(nodeId);
    FormulaDebugger.traceEnqueue(nodeId, 'Manual enqueue');
    this.scheduler.scheduleIfIdle(
      async () => this.processQueue(),
      { queueSize: this.queue.size() },
    );
  }

  /**
   * Enqueues all dependents of a node and schedules batch processing.
   */
  public enqueueDependents(id: string): void {
    const dependents = this.graph.getDependents(id);

    for (const dependentId of dependents) {
      this.queue.enqueue(dependentId);
      FormulaDebugger.traceEnqueue(dependentId, `Cascade from ${id}`);
    }

    // Schedule processing if items were enqueued
    if (dependents.length > 0) {
      this.scheduler.scheduleIfIdle(
        async () => this.processQueue(),
        { queueSize: this.queue.size() },
      );
    }
  }

  /**
   * Waits for all currently scheduled processing to complete.
   * Returns immediately if no processing is scheduled.
   */
  public async waitForProcessing(): Promise<void> {
    const promise = this.scheduler.getProcessingPromise();

    if (promise) {
      await promise;
    }
  }

  /**
   * Registers an object so that when it is garbage-collected, runtime cleans up graph & registry.
   * Library users call this via PropertyManager; implementation detail hidden.
   */
  public register(nodeId: string, target: object): void {
    this.finalizer.register(target, nodeId);
  }

  /**
   * Explicitly removes registration of an object if it was removed manually.
   */
  public unregister(target: FormulaNode): void {
    this.finalizer.unregister(target);
  }

  private async processQueue(): Promise<void> {
    // "using" declarations for automatic resource management
    using session = QueueProcessor.createSession({
      dequeue: () => this.queue.dequeue(),
      onStart: () => this.scheduler.markProcessingStarted(),
      onComplete: () => this.scheduler.markProcessingComplete(),
    });

    try {
      for await (const nodeId of session.processItems()) {
        await this.processQueueItem(nodeId);
      }
    }
    catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[FormulaRuntime] Global processing error:', err);
      throw err;
    }
    finally {
      // Check if more items were added during processing and schedule if needed
      this.scheduleAdditionalProcessingIfNeeded();
    }
    // session automatically disposed thanks to 'using'
  }

  /**
   * Process individual queue item with comprehensive error handling.
   */
  private async processQueueItem(nodeId: string): Promise<void> {
    try {
      const processingContext = await this.extractAndValidateNode(nodeId);
      if (!processingContext) {
        return;
      }

      const { result, dependencies } = await this.executor.exec({
        expression: processingContext.expression,
        context: processingContext.context,
      });

      // Update result
      this.adapter.onCalculate(processingContext.node, result, new Set(dependencies));

      const dependents = this.graph.getDependents(nodeId);

      for (const dependentId of dependents) {
        this.queue.enqueue(dependentId);
        FormulaDebugger.traceEnqueue(dependentId, `Cascade from ${nodeId}`);
      }
    }
    catch (error) {
      const node = this.nodeProvider(nodeId);
      if (!node) {
        return;
      }

      const err = error instanceof Error ? error : new Error(String(error));
      FormulaDebugger.traceError(nodeId, err);

      this.adapter.onError(node, err);
    }
  }

  /**
   * Extract and validate node for processing.
   */
  private async extractAndValidateNode(nodeId: string): Promise<{
    node: T;
    expression: Expression;
    context: Record<string, FormulaDataType>;
    dependencies: ReadonlySet<string>;
  } | null> {
    const node = this.nodeProvider(nodeId);
    if (!node || !this.adapter.shouldProcess(node)) {
      return null;
    }

    let expression = this.adapter.toExpression(node);

    const formulaValidation = this.validator.validateFormula(expression);
    if (!formulaValidation.isValid) {
      throw formulaValidation.error;
    }

    // Already validated by FormulaValidator
    expression = expression as Expression;

    FormulaDebugger.traceProcessing(nodeId, expression);

    // Extract static dependencies
    const staticDeps = expression.extractDependencies();

    // Validate using FormulaValidator
    const depsValidation = this.validator.validateDependencies(nodeId, staticDeps);
    if (!depsValidation.isValid) {
      throw depsValidation.error;
    }

    // Update dependency graph
    this.graph.replaceDependencies(nodeId, staticDeps);

    // Validate depth after updating dependencies
    const depthValidation = this.validator.validateDepth(nodeId, this.graph);
    if (!depthValidation.isValid) {
      throw depthValidation.error;
    }

    // Build execution context
    const context = this.buildExecutionContext(staticDeps);

    return { node, expression, context, dependencies: staticDeps };
  }

  /**
   * Build execution context from dependencies.
   */
  private buildExecutionContext(dependencies: ReadonlySet<string>): Record<string, FormulaDataType> {
    const context: Record<string, FormulaDataType> = {};

    for (const depId of dependencies) {
      const dep = this.nodeProvider(depId);

      if (dep) {
        const value = this.adapter.toFormulaDataType(dep);
        context[depId] = value;
      }
    }

    return context;
  }

  /**
   * Schedule additional processing if more items were added during processing.
   * This ensures all cascaded updates are processed.
   */
  private scheduleAdditionalProcessingIfNeeded(): void {
    if (this.queue.size() > 0) {
      this.scheduler.scheduleIfIdle(
        async () => this.processQueue(),
        { queueSize: this.queue.size() },
      );
    }
  }
}
