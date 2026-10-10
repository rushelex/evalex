import type { Class } from 'type-fest';

import type { AST } from '../../parser';
import type { FormulaDataType } from '../data-types';
import type { FormulaEvaluatorVisitor } from '../evaluator.visitor';
import type { ArgumentsPattern, ProcessedArguments, Signatures, SubjectSignature, SubjectSignatures } from './arguments';
import type { FunctionRoutineHandler, MethodRoutineHandler, SubjectRoutineHandler } from './routine';
import type { RoutineExampleOptions } from './routine-example';

import { ALL_DATA_TYPES, Kind } from '../data-types';
import { Errors } from '../errors';
import { Argument, ArgumentsDefinitions, ProcessedArgument } from './arguments';
import { Routine } from './routine';
import { RoutineExamples } from './routine-examples';

interface SingleFormDefinition<TSignatures extends Signatures | undefined> {
  /** One sentence shown in UI tooltips. */
  readonly description: string;
  readonly examples: readonly RoutineExampleOptions[];
  /** One signature, or a list of alternative signatures, built with `arg`; omitted when the handler reads the call syntax itself. */
  readonly arguments?: TSignatures;
}

export interface FunctionDefinition<TSignatures extends Signatures | undefined> extends SingleFormDefinition<TSignatures> {
  readonly handler: FunctionRoutineHandler<TSignatures>;
}

export interface MethodDefinition<TInstance extends FormulaDataType, TSignatures extends Signatures | undefined> extends SingleFormDefinition<TSignatures> {
  readonly handler: MethodRoutineHandler<TInstance, TSignatures>;
}

/** A name shared by both forms, or separate names for the function and the method. */
export type RoutineName = string | { readonly function: string; readonly method: string };

export interface RoutineDefinition<TSignatures extends SubjectSignatures> {
  /** One sentence shown in UI tooltips for both forms. */
  readonly description: string;
  /** Examples written once with `name(subject, ...args)` and run in both forms. */
  readonly examples: readonly RoutineExampleOptions[];
  /**
   * One signature, or a list of alternative signatures, built with `arg`.
   *
   * @remarks
   * The first argument of each is the call subject; its types decide which data types get the method form.
   */
  readonly arguments: TSignatures;
  /** Implementation shared by both forms; receives the call subject apart from the remaining arguments. */
  readonly handler: SubjectRoutineHandler<TSignatures>;
}

/**
 * Unified routines registry to register functions and methods without side effects.
 * Supports method inheritance across FormulaDataType subclasses and caches resolved lookups after finalize().
 */
export class RoutinesRegistry {
  readonly #functionRegistry: Map<string, Routine> = new Map();
  readonly #methodRegistry: Map<Class<FormulaDataType>, Map<string, Routine>> = new Map();
  readonly #methodNames: Map<string, string> = new Map();
  #resolvedMethodsCache: WeakMap<Class<FormulaDataType>, Map<string, Routine>> | null = null;

  /**
   * Registers a routine that exists only as a function, such as `if`, `now` or `pi`.
   *
   * @remarks
   * A routine with a call subject is registered with {@link RoutinesRegistry.registerRoutine} instead,
   * so that `f(x)` and `x.f()` share one description and cannot drift apart.
   * A second registration under the same name replaces the first.
   */
  registerFunction<const TSignatures extends Signatures | undefined = undefined>(name: string, definition: FunctionDefinition<TSignatures>): void {
    const handler = definition.handler as FunctionRoutineHandler<Signatures | undefined>;

    this.#functionRegistry.set(name, new Routine({
      description: definition.description,
      examples: new RoutineExamples(name, definition.examples).toFunctionExamples(),
      arguments: definition.arguments,
      handler: ({ node, args, visitor, location }) => handler({ node, args: args && toValues(args), visitor, location } as Parameters<typeof handler>[0]),
    }));
  }

  /**
   * Registers a routine that exists only as a method of one data type, such as `date.subtract()`.
   *
   * @remarks
   * The method is inherited by subclasses of the data type. Its arguments are those inside the parentheses;
   * the handler reads the value before the dot from `instance`.
   * A routine with both forms is registered with {@link RoutinesRegistry.registerRoutine} instead.
   * A second registration under the same name on the same type replaces the first.
   */
  registerMethod<TInstance extends FormulaDataType, const TSignatures extends Signatures | undefined = undefined>(
    dataTypeCtor: Class<TInstance>,
    name: string,
    definition: MethodDefinition<TInstance, TSignatures>,
  ): void {
    const handler = definition.handler as MethodRoutineHandler<FormulaDataType, Signatures | undefined>;

    if (!this.#methodRegistry.has(dataTypeCtor)) {
      this.#methodRegistry.set(dataTypeCtor, new Map());
    }

    this.#methodRegistry.get(dataTypeCtor)!.set(name, new Routine<FormulaDataType>({
      description: definition.description,
      examples: new RoutineExamples(name, definition.examples).toMethodExamples(),
      arguments: definition.arguments,
      handler: ({ instance, args, visitor, location }) => handler({ instance, args: toValues(args), visitor, location } as Parameters<typeof handler>[0]),
    }) as Routine);

    this.#invalidateCache();
  }

  /**
   * Registers a routine once for both call forms: `f(x, a)` as a function and `x.f(a)` as a method.
   *
   * @remarks
   * The method exists on every data type the first argument accepts, and on a type it gets only the signatures
   * that accept that type. The handler receives the call subject (`x`) and the remaining arguments (`a`)
   * the same way for both forms, typed from the signatures.
   *
   * @throws Error when the function or the method name is already registered.
   */
  registerRoutine<const TSignatures extends SubjectSignatures>(name: RoutineName, definition: RoutineDefinition<TSignatures>): void {
    const functionName = typeof name === 'string' ? name : name.function;
    const methodName = typeof name === 'string' ? name : name.method;
    const signatures = new ArgumentsDefinitions(definition.arguments).alternatives as readonly SubjectSignature[];
    const handler = definition.handler as ErasedSubjectHandler;

    const methods = subjectDataTypes(signatures).map((ctor) => {
      const accepted = signatures.filter(([subject]) => acceptsKind(subject, ctor.kind));

      return { ctor, subjects: accepted.map(([subject]) => subject), signatures: accepted.map(toMethodSignature) };
    });

    if (this.#functionRegistry.has(functionName) || methods.some(({ ctor }) => this.#methodRegistry.get(ctor)?.has(methodName))) {
      throw new Error(`Routine "${typeof name === 'string' ? name : `${functionName}/${methodName}`}" is already registered.`);
    }

    this.#methodNames.set(functionName, methodName);
    this.#functionRegistry.set(functionName, new Routine({
      description: definition.description,
      examples: new RoutineExamples(functionName, definition.examples).toFunctionExamples(),
      arguments: signatures,
      handler: ({ args, visitor, location }) => {
        const [subject, ...rest] = toValues(args!);

        return handler({ subject: subject as FormulaDataType, args: rest, locations: toLocations(args!).slice(1), visitor, location });
      },
    }));

    for (const { ctor, subjects, signatures: ctorSignatures } of methods) {
      if (!this.#methodRegistry.has(ctor)) {
        this.#methodRegistry.set(ctor, new Map());
      }

      this.#methodRegistry.get(ctor)!.set(methodName, new Routine<FormulaDataType>({
        description: definition.description,
        examples: new RoutineExamples(methodName, definition.examples).toMethodExamples(),
        arguments: ctorSignatures,
        handler: ({ instance, args, visitor, location }) => {
          validateSubject(subjects, instance, location);

          return handler({ subject: instance, args: toValues(args), locations: toLocations(args), visitor, location });
        },
      }) as Routine);
    }

    this.#invalidateCache();
  }

  /** Resolves inherited methods of every registered type up front, so that lookups during evaluation hit a cache. */
  finalize(): void {
    const cache = new WeakMap<Class<FormulaDataType>, Map<string, Routine>>();

    for (const ctor of this.#methodRegistry.keys()) {
      cache.set(ctor, this.#resolveMethodsForCtor(ctor));
    }

    this.#resolvedMethodsCache = cache;
  }

  /** Returns the function form registered under the name, or `undefined` when there is none. */
  getFunction(name: string): Routine | undefined {
    return this.#functionRegistry.get(name);
  }

  /** Returns the method form registered together with the function by {@link RoutinesRegistry.registerRoutine}, or `undefined` when there is none. */
  getMethodName(functionName: string): string | undefined {
    return this.#methodNames.get(functionName);
  }

  /** Returns every function form by name, for autocompletion and documentation. */
  getFunctions(): ReadonlyMap<string, Routine> {
    return this.#functionRegistry;
  }

  /** Returns the method of the type, inherited ones included, or `undefined` when there is none. */
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

  /** Returns every method of the type by name, inherited ones included. */
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

function acceptsKind(argument: Argument, kind: Kind): boolean {
  const kinds = Array.isArray(argument.types) ? argument.types : [argument.types];

  return kinds.includes(Kind.Any) || kinds.includes(kind);
}

// Data types whose values some signature accepts as the subject, in the order of `ALL_DATA_TYPES`.
function subjectDataTypes(signatures: readonly SubjectSignature[]): typeof ALL_DATA_TYPES {
  return ALL_DATA_TYPES.filter((ctor) => signatures.some(([subject]) => acceptsKind(subject, ctor.kind)));
}

// The signatures guarantee each value's type, so the wrappers hand the typed handler untyped values.
type ErasedSubjectHandler = (context: {
  readonly subject: FormulaDataType;
  readonly args: unknown[];
  readonly locations: readonly AST.Location[];
  readonly visitor: FormulaEvaluatorVisitor;
  readonly location: AST.Location;
}) => FormulaDataType;

function toLocations(args: ProcessedArguments): AST.Location[] {
  return args.map((arg) => arg.location);
}

// Handlers receive values, not their syntax: a callback stays an executor, anything else becomes its data type.
function toValues(args: ProcessedArguments): unknown[] {
  return args.map((arg) => (arg instanceof ProcessedArgument ? arg.dataType : arg));
}

// The method form drops the subject argument, so its custom validation runs here, as it does for the function form.
function validateSubject(subjects: readonly Argument[], instance: FormulaDataType, location: AST.Location): void {
  for (const subject of subjects) {
    const failure = subject.validation?.(instance);

    if (failure) {
      throw Errors.Argument.Validation.create({
        actual: String(instance.value),
        expected: ['valid value'],
        ...failure,
        argumentPosition: 0,
      }, { location });
    }
  }
}

// The method form drops the subject; a repeatable subject (`sum(...numbers)`) stays as optional further values.
function toMethodSignature(signature: ArgumentsPattern): ArgumentsPattern {
  const [subject, ...rest] = signature;

  if (subject instanceof Argument && subject.repeatable) {
    return [new Argument(subject.types, { name: subject.name, repeatable: true, optional: true, validation: subject.validation }), ...rest];
  }

  return rest;
}
