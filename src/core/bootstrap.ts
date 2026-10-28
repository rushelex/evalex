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
 * Applies plugins to the shared routine registry and closes it to further registration.
 *
 * @remarks
 * Importing this module already registers the built-in routines. The plugin API is not public until the first real
 * plugin shapes it (#41 step 6), so only the test setup calls this.
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
