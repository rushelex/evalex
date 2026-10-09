import type { Class, Merge } from 'type-fest';

import type { FormulaDataType } from '../data-types';
import type { ArgumentsPattern, ProcessedArgument, RoutineArguments } from './arguments';
import type { RoutineOptions, SubjectRoutineHandler } from './routine';
import type { RoutineExamples } from './routine-examples';

import { Kind } from '../data-types';
import { Argument, ArgumentsDefinitions } from './arguments';
import { Routine } from './routine';

type RegisterRoutineOptions<TInstance extends FormulaDataType | unknown = unknown> = Merge<RoutineOptions<TInstance>, {
  examples: (routineName: string) => RoutineExamples;
  arguments?: RoutineArguments | (() => RoutineArguments);
}>;

/** A name shared by both forms, or separate names for the function and the method. */
export type RoutineName = string | { readonly function: string; readonly method: string };

export interface RegisterSubjectRoutineOptions<TDataType extends Class<FormulaDataType>> {
  /** Data types that get the method form. */
  readonly on: readonly TDataType[];
  readonly description: string;
  readonly examples: (routineName: string) => RoutineExamples;
  /** Signatures of the function form; the first argument of each is the call subject. */
  readonly arguments: () => RoutineArguments;
  readonly handler: SubjectRoutineHandler<InstanceType<TDataType>>;
}

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

  /**
   * Registers a routine once for both call forms: `f(x, a)` as a function and `x.f(a)` as a method on each type in `on`.
   *
   * @remarks
   * The handler receives the call subject (`x`) and the remaining arguments (`a`) the same way for both forms.
   * The method on a type gets only the signatures whose first argument accepts that type.
   *
   * @throws Error when a name is already registered, or when no signature accepts a type from `on` as the subject.
   */
  registerRoutine<TDataType extends Class<FormulaDataType>>(name: RoutineName, options: RegisterSubjectRoutineOptions<TDataType>): void {
    const functionName = typeof name === 'string' ? name : name.function;
    const methodName = typeof name === 'string' ? name : name.method;
    const signatures = new ArgumentsDefinitions(options.arguments().alternatives).alternatives;

    const methodSignatures = options.on.map((ctor) => {
      const kind = (ctor as { kind?: Kind }).kind;
      const accepted = signatures.filter(([subject]) => subject instanceof Argument && acceptsKind(subject, kind));

      if (accepted.length === 0) {
        throw new Error(`Routine "${methodName}" has no signature whose first argument accepts ${kind ?? ctor.name}.`);
      }

      return { ctor, signatures: accepted.map(toMethodSignature) };
    });

    if (this.#functionRegistry.has(functionName) || options.on.some((ctor) => this.#methodRegistry.get(ctor)?.has(methodName))) {
      throw new Error(`Routine "${typeof name === 'string' ? name : `${functionName}/${methodName}`}" is already registered.`);
    }

    this.#functionRegistry.set(functionName, new Routine({
      description: options.description,
      examples: options.examples(functionName).toFunctionExamples(),
      arguments: signatures,
      handler: ({ args, visitor, location, utils }) => {
        const [subject, ...rest] = args!;

        // Argument validation has already matched the subject against the signatures.
        return options.handler({ subject: (subject as ProcessedArgument).dataType as InstanceType<TDataType>, args: rest, visitor, location, utils });
      },
    }));

    for (const { ctor, signatures: ctorSignatures } of methodSignatures) {
      if (!this.#methodRegistry.has(ctor)) {
        this.#methodRegistry.set(ctor, new Map());
      }

      this.#methodRegistry.get(ctor)!.set(methodName, new Routine<FormulaDataType>({
        description: options.description,
        examples: options.examples(methodName).toMethodExamples(),
        arguments: ctorSignatures,
        handler: ({ instance, args, visitor, location, utils }) => {
          // The method is registered only on the types from `on`.
          return options.handler({ subject: instance as InstanceType<TDataType>, args, visitor, location, utils });
        },
      }) as Routine);
    }

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

function acceptsKind(argument: Argument, kind: Kind | undefined): boolean {
  const kinds = Array.isArray(argument.types) ? argument.types : [argument.types];

  return kinds.includes(Kind.Any) || (kind !== undefined && kinds.includes(kind));
}

// The method form drops the subject; a repeatable subject (`sum(...numbers)`) stays as optional further values.
function toMethodSignature(signature: ArgumentsPattern): ArgumentsPattern {
  const [subject, ...rest] = signature;

  if (subject instanceof Argument && subject.repeatable) {
    return [new Argument(subject.types, { name: subject.name, repeatable: true, optional: true, validation: subject.validation }), ...rest];
  }

  return rest;
}
