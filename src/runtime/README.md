<div align="center">

# evalex / runtime

**Keeps a graph of formulas up to date — dependency tracking, ordered recalculation, cycle detection and batching.**

[Quick start](#quick-start) · [Adapter](#the-adapter) · [Updates](#triggering-updates) · [Scheduling](#scheduling-and-execution) · [Limits](#errors-and-limits)

</div>

---

A single formula is handled by [`Expression`](../core/README.md#expression). Once formulas start reading each other's results — computed table columns, spreadsheet cells, derived form fields — something has to decide what to recalculate and in which order. That is the runtime's job.

You keep owning your data. The runtime never stores values itself: it reads and writes your nodes through an adapter you provide.

## Quick start

```ts
import { Expression, FormulaNull, FormulaNumber, FormulaOrchestrator } from 'evalex';
import type { FormulaDataType } from 'evalex';

interface Cell {
  readonly id: string;
  readonly formula?: string;
  value: FormulaDataType | null;
  error?: Error;
}

const orchestrator = new FormulaOrchestrator<Cell>({
  adapter: {
    shouldProcess: (cell) => cell.formula !== undefined,
    toFormulaDataType: (cell) => cell.value ?? FormulaNull.instance(),
    toExpression: (cell) => (cell.formula ? new Expression(cell.formula) : null),
    onCalculate: (cell, value) => {
      cell.value = value;
      cell.error = undefined;
    },
    onError: (cell, error) => {
      cell.error = error;
    },
  },
});

const price: Cell = { id: 'price', value: new FormulaNumber(100) };
const total: Cell = { id: 'total', formula: 'price * 2', value: null };
const tax: Cell = { id: 'tax', formula: 'total * 0.1', value: null };

orchestrator.add(price);
orchestrator.add(total);
orchestrator.add(tax);
await orchestrator.waitForProcessing();
// total.value → 200, tax.value → 20

price.value = new FormulaNumber(150);
orchestrator.enqueueDependents('price');
await orchestrator.waitForProcessing();
// total.value → 300, tax.value → 30
```

A node's `id` is the name formulas use to reference it: `total` reads `price` because a node with `id: 'price'` exists.

## The adapter

`NodeAdapter<T>` connects the runtime to your node type. `T` only needs a readonly `id: string`.

| Callback | Called to | Return |
| --- | --- | --- |
| `shouldProcess(node)` | Tell formula nodes from plain value nodes | `true` for nodes that hold a formula |
| `toFormulaDataType(node)` | Read a node's current value when another formula depends on it | A `FormulaDataType` |
| `toExpression(node)` | Get the node's formula | An `Expression`, or `null` to skip the node |
| `onCalculate(node, value, dependencies)` | Store a fresh result; `dependencies` are the ids the evaluation actually read. Not called for a formula that was not recalculated, see [Skipped recalculation](#skipped-recalculation) | — |
| `onError(node, error)` | Store a failure: a `SyntaxError`, a `FormulaError` or a runtime limit error | — |

> [!TIP]
> Return the same `Expression` instance, or at least the same formula text, between calls. The runtime caches validation per node and skips it while the formula text stays the same.

## Triggering updates

| Method | Use it when |
| --- | --- |
| `add(node, subscribe?)` | A node appears. Formula nodes are calculated right away. Throws if the id is taken |
| `enqueueDependents(id)` | A node's value changed and everything that reads it must recalculate. Give the node a new value instead of changing the old one in place |
| `enqueue(id)` | A node's own formula changed. A formula with the same text and the same input values keeps its result |
| `remove(id)` | A node disappears. Calls its unsubscribe function and drops it from the graph |
| `waitForProcessing()` | You need every pending calculation to finish |
| `get(id)`, `has(id)`, `getAllIds()` | You need to look nodes up |

Recalculation cascades: when `total` is recalculated, `tax` is queued next, and so on down the graph.

The optional `subscribe` argument wires your own change notifications to the runtime. It is called once on `add`, and the function it returns is called on `remove`:

```ts
orchestrator.add(cell, () => cell.onChange(() => {
  orchestrator.enqueueDependents(cell.id);
}));
```

### Skipped recalculation

The runtime skips work whose outcome it already knows, so a skipped formula gets no `onCalculate` call:

- `enqueueDependents(id)` with the value the dependents already hold.
- A formula whose input values are the same as at its last successful calculation.
- The dependents of a formula whose new result equals the previous one.

Values are compared as immutable: the same instance counts as unchanged, and so do equal numbers, strings, booleans and nulls. Any other new list, object or date counts as changed, even with equal contents.

Formulas calling a volatile routine, such as `now()` or `today()`, are recalculated whenever one of their inputs is updated, even with the same value. A formula that failed is retried on the next update, even with the same value.

### Which dependencies count

The graph is built from every identifier a formula mentions, so `if(flag, a, b)` recalculates when `flag`, `a` or `b` changes, regardless of which branch ran last. `onCalculate` receives the narrower set the last evaluation actually read — `flag` and `b` when `flag` is false.

## Scheduling and execution

Two pluggable parts control when and how formulas run. Both are optional; the defaults suit most apps.

```ts
import { AsyncExecutor, BatchingScheduler, FormulaOrchestrator } from 'evalex';

const orchestrator = new FormulaOrchestrator({
  adapter,
  scheduler: new BatchingScheduler({ delayMs: 16 }),
  executor: new AsyncExecutor({ timeoutMs: 500 }),
});
```

| Scheduler | Behavior |
| --- | --- |
| `ImmediateScheduler` *(default)* | Starts processing as soon as something is enqueued |
| `BatchingScheduler({ delayMs })` | Waits `delayMs` to collect updates, then processes them in one pass. Good for fast-changing UI input |

| Executor | Behavior |
| --- | --- |
| `SyncExecutor` *(default)* | Evaluates each formula synchronously |
| `AsyncExecutor(options)` | Evaluates each formula as a separate async job that can time out or be aborted |

`AsyncExecutor` options:

| Option | Effect |
| --- | --- |
| `timeoutMs` | Fails a formula that runs longer, reported through `onError` |
| `abortController` | Aborts pending jobs when signaled |
| `runner(job, signal)` | Decides how a job is run; the default queues it as a microtask |
| `onTerminate()` | Called by `terminate()` after it aborts pending jobs |

## Errors and limits

Problems with one formula never stop the rest: the error goes to that node's `onError`, and every other formula keeps calculating.

| Code | Raised when |
| --- | --- |
| `CIRCULAR_DEPENDENCY` | A formula would depend on itself, directly or through other formulas |
| `MAX_DEPENDENCIES_EXCEEDED` | A formula references more than 100 identifiers |
| `MAX_FORMULA_DEPTH_EXCEEDED` | A chain of formulas is deeper than 50 levels |
| `MAX_FORMULAS_EXCEEDED` | `add` is called when 10,000 formula nodes already exist; thrown from `add` itself |
| `TYPE_MISMATCH` | `toExpression` returns an expression whose formula is empty or not text |

Errors from evaluating the formula itself are listed in the [core README](../core/README.md#errors).

```ts
onError: (cell, error) => {
  if (error instanceof FormulaError && error.code === 'CIRCULAR_DEPENDENCY') {
    error.message; // 'Circular dependency detected: b depends on a.'
  }
}
```

## Lower-level building blocks

`FormulaOrchestrator` is a thin layer that adds a node registry and subscriptions. The parts beneath it are exported too, for cases where you already keep nodes in your own store:

| Export | Role |
| --- | --- |
| `FormulaRuntime` | Queue processing, cascades and graph ownership. Reads nodes through a `nodeProvider(id)` callback instead of a registry |
| `DependencyGraph` | Directed graph of node ids with cycle detection and depth tracking |
| `RecalculationQueue` | Deduplicating FIFO queue of node ids |

`FormulaRuntime` also registers nodes in a `FinalizationRegistry`: when a node object is garbage-collected, its graph edges are removed and `onNodeCleanup(id)` is called.

## Source layout

| Path | Contents |
| --- | --- |
| [`orchestrator.ts`](./orchestrator.ts) | `FormulaOrchestrator` |
| [`runtime.ts`](./runtime.ts) | `FormulaRuntime` and its per-node validation cache |
| [`is-same-value.ts`](./is-same-value.ts) | The equality that decides whether recalculation can be skipped |
| [`dependency-graph.ts`](./dependency-graph.ts) | `DependencyGraph` |
| [`recalculation-queue.ts`](./recalculation-queue.ts) | `RecalculationQueue` |
| [`formula-validator.ts`](./formula-validator.ts), [`limits.ts`](./limits.ts) | Limit checks and their values |
| [`scheduler/`](./scheduler), [`executor/`](./executor) | Schedulers and executors |
| [`types.ts`](./types.ts) | `FormulaNode` and `NodeAdapter` |
