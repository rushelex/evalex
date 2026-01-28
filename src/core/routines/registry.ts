import type { Class, Merge } from 'type-fest';

import type { FormulaDataType } from '../data-types';
import type { RoutineArguments } from './arguments';
import type { RoutineOptions } from './routine';
import type { RoutineExamples } from './routine-examples';

import { Routine } from './routine';

type RegisterRoutineOptions<TInstance extends FormulaDataType | unknown = unknown> = Merge<RoutineOptions<TInstance>, {
  examples: (routineName: string) => RoutineExamples;
  arguments?: RoutineArguments | (() => RoutineArguments);
}>;

/**
 * Unified routines registry to register functions and methods without side effects.
 * Supports method inheritance across FormulaDataType subclasses and caches resolved lookups after finalize().
 */
export class RoutinesRegistry {
  readonly #functionRegistry: Map<string, Routine> = new Map();
  readonly #methodRegistry: Map<Class<FormulaDataType>, Map<string, Routine>> = new Map();
  #resolvedMethodsCache: WeakMap<Class<FormulaDataType>, Map<string, Routine>> | null = null;

  registerFunction(name: string, options: RegisterRoutineOptions): void {
    const examplesOption = options.examples(name).toFunctionExamples();
    const argumentsOption = typeof options.arguments === 'function' ? options.arguments() : options.arguments;
    this.#functionRegistry.set(name, new Routine({
      ...options,
      examples: examplesOption,
      arguments: argumentsOption,
    }));
  }

  registerMethod<TInstance extends FormulaDataType>(
    dataTypeCtor: Class<TInstance>,
    name: string,
    options: RegisterRoutineOptions<TInstance>,
  ): void {
    if (!this.#methodRegistry.has(dataTypeCtor)) {
      this.#methodRegistry.set(dataTypeCtor, new Map());
    }

    const typeMethods = this.#methodRegistry.get(dataTypeCtor)!;

    const examplesOption = options.examples(name).toMethodExamples();

    const argumentsOption = typeof options.arguments === 'function' ? options.arguments() : options.arguments;

    typeMethods.set(name, new Routine({
      ...options,
      examples: examplesOption,
      arguments: argumentsOption?.toMethodArgs(),
    } as RoutineOptions<unknown>));

    this.#invalidateCache();
  }

  finalize(): void {
    const cache = new WeakMap<Class<FormulaDataType>, Map<string, Routine>>();

    for (const ctor of this.#methodRegistry.keys()) {
      cache.set(ctor, this.#resolveMethodsForCtor(ctor));
    }

    this.#resolvedMethodsCache = cache;
  }

  getFunction(name: string): Routine | undefined {
    return this.#functionRegistry.get(name);
  }

  getMethod(ctor: Class<FormulaDataType>, name: string): Routine | undefined {
    const methods = this.getMethods(ctor);
    return methods.get(name);
  }

  /**
   * Returns all data type constructors that have registered methods.
   * Useful for iterating over all known data types when generating test cases.
   */
  getRegisteredDataTypes(): Class<FormulaDataType>[] {
    return Array.from(this.#methodRegistry.keys());
  }

  getMethods(ctor: Class<FormulaDataType>): Map<string, Routine> {
    if (this.#resolvedMethodsCache?.has(ctor)) {
      // Use finalized cache when available
      return this.#resolvedMethodsCache.get(ctor)!;
    }

    // Compute on-demand when not finalized or unknown ctor
    const computed = this.#resolveMethodsForCtor(ctor);

    // Opportunistically cache if finalized cache already exists (extend it)
    if (this.#resolvedMethodsCache) {
      this.#resolvedMethodsCache.set(ctor, computed);
    }

    return computed;
  }

  #resolveMethodsForCtor(ctor: Class<FormulaDataType>): Map<string, Routine> {
    const chain = this.#getPrototypeChain(ctor);
    const out = new Map<string, Routine>();

    for (const c of chain) {
      const map = this.#methodRegistry.get(c);
      if (!map) {
        continue;
      }

      for (const [name, routine] of map) {
        // Later entries in chain (closer to the leaf) should override
        out.set(name, routine);
      }
    }

    return out;
  }

  #getPrototypeChain(ctor: Class<FormulaDataType>): Class<FormulaDataType>[] {
    // Collect from base to leaf to preserve override precedence
    const chain: Class<FormulaDataType>[] = [];
    const seen = new Set<Class<FormulaDataType>>();

    let current: Class<FormulaDataType> | null = ctor;
    while (current) {
      // Insert at the start to get base-first order
      chain.unshift(current);
      seen.add(current);

      const proto = Object.getPrototypeOf(current.prototype) as object;
      if (!proto || proto === Object.prototype) {
        break;
      }

      const parent = proto.constructor as Class<FormulaDataType> | undefined;
      if (!parent || seen.has(parent)) {
        break;
      }

      current = parent;
    }

    return chain;
  }

  #invalidateCache(): void {
    this.#resolvedMethodsCache = null;
  }
}

export const routinesRegistry = new RoutinesRegistry();
