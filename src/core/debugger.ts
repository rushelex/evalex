import type { FormulaDataType } from './data-types';
import type { Expression } from './expression';

export class FormulaDebugger {
  static #enabled = false;

  static enable() {
    FormulaDebugger.#enabled = true;
  }

  static disable() {
    FormulaDebugger.#enabled = false;
  }

  static trace(expression: string, result: FormulaDataType) {
    if (FormulaDebugger.#enabled) {
      // eslint-disable-next-line no-console
      console.info(`Formula: ${expression} => ${result.displayType}: ${result.value}`);
    }
  }

  static traceEnqueue(nodeId: string, reason: string) {
    if (FormulaDebugger.#enabled) {
      // eslint-disable-next-line no-console
      console.info(`[Formula Queue] Enqueued ${nodeId}: ${reason}`);
    }
  }

  static traceProcessing(nodeId: string, expression: Expression) {
    if (FormulaDebugger.#enabled) {
      // eslint-disable-next-line no-console
      console.info(`[Formula Process] Evaluating ${nodeId}: ${expression.formula}`);
    }
  }

  static traceCascade(from: string, to: readonly string[]) {
    if (FormulaDebugger.#enabled && to.length > 0) {
      // eslint-disable-next-line no-console
      console.info(`[Formula Cascade] ${from} -> [${to.join(', ')}]`);
    }
  }

  static traceError(nodeId: string, error: Error) {
    if (FormulaDebugger.#enabled) {
      console.error(`[Formula Error] ${nodeId}:`, error.message);
    }
  }

  static traceDependencyUpdate(nodeId: string, oldDeps: ReadonlySet<string>, newDeps: ReadonlySet<string>) {
    if (FormulaDebugger.#enabled) {
      const added = Array.from(newDeps).filter((d) => !oldDeps.has(d));
      const removed = Array.from(oldDeps).filter((d) => !newDeps.has(d));

      if (added.length > 0 || removed.length > 0) {
        // eslint-disable-next-line no-console
        console.info(`[Formula Deps] ${nodeId}: +[${added.join(', ')}] -[${removed.join(', ')}]`);
      }
    }
  }
}
