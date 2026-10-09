// Side-effect imports to attach static converters and register built-in routines
import './data-types/array/convert';
import './data-types/object/convert';
import './routines/routines';

import type { RoutinesRegistry } from './routines/registry';

import { routinesRegistry } from './routines/registry';

export type FormulaPlugin = (registry: RoutinesRegistry) => void;

export interface InitializeFormulaOptions {
  readonly plugins?: ReadonlyArray<FormulaPlugin>;
  readonly finalize?: boolean; // default: true
}

/**
 * Initializes formula core: registers built-in routines and applies plugins.
 * - If you rely on side-effect import of `core/index.ts`, you may not need to call this.
 * - Use this explicit initializer in apps to have predictable bootstrap and plugin registration.
 */
export function initializeFormulaCore(options?: InitializeFormulaOptions): { registry: RoutinesRegistry } {
  const { plugins = [], finalize = true } = options ?? {};

  for (const plugin of plugins) {
    plugin(routinesRegistry);
  }

  if (finalize) {
    routinesRegistry.finalize();
  }

  return { registry: routinesRegistry };
}
