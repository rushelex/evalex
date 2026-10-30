import type { AST } from '../parser';
import type { FormulaDataType } from './data-types';
import type { ArgumentsPattern } from './routines/arguments';
import type { Routine } from './routines/routine';
import type { FormulaType } from './types';

import { FormulaEvaluationContext } from './context';
import { ALL_DATA_TYPES, Kind } from './data-types';
import { convertValueToFormulaType } from './data-types/converter';
import { Errors, FormulaError } from './errors';
import { FormulaEvaluatorVisitor } from './evaluator.visitor';
import { representativeValue } from './representative-value';
import { Argument, CallbackArgument, ProcessedArgument } from './routines/arguments';
import { routinesRegistry } from './routines/registry';
import { kindsOf, membersOf, type, TypeBindings, unionOf } from './types';

interface TypeInferenceOptions {
  /** The types of the names the formula reads from its record. */
  readonly fields: ReadonlyMap<string, FormulaType>;
  /** The types of the names the formula declares around the node, which hide the fields. */
  readonly locals?: ReadonlyMap<string, FormulaType>;
  /** Gathers the types of the value a method call is read on, in every scope it is read in. */
  readonly probe?: SubjectProbe;
  /** Gathers the errors evaluation raises whenever it reaches the node they point at; nothing is gathered without it. */
  readonly errors?: FormulaError[];
  /** A name neither in `fields` nor in `locals` is an error, as `fields` lists every name the formula can read. */
  readonly closedNames?: boolean;
}

interface SubjectProbe {
  /** The method name of the call, as the parser read it. */
  readonly method: AST.IIdentifierNode;
  readonly subjects: FormulaType[];
}

// The kinds of the values a call is checked with are tried together, up to this many sets of them
const MAX_KIND_COMBINATIONS = 32;

// A value of these nodes always comes from the node itself, so an error about it points at the whole node
const OWN_ORIGIN = new Set<AST.AstNode['type']>(['Literal', 'Identifier', 'ArrayExpression', 'UnaryExpression', 'BinaryExpression']);

// Stands in for the evaluator of the callbacks a call is checked with; it never evaluates them
const CHECK_VISITOR = new FormulaEvaluatorVisitor('', new FormulaEvaluationContext(new Map()));

/**
 * Infers the type of a node with the names in scope where it stands: local ones first, then the fields.
 *
 * @remarks
 * Reads every argument of a call at least once, also where the type of the call does not depend on it, so a probe
 * finds a method call and an error is found wherever they stand. An error is gathered only where evaluation raises it
 * on every value of the types, and only in a part evaluation reaches when it reaches the call around it: not in the
 * arguments of a call that fails before evaluating them.
 */
export class TypeInferenceVisitor implements AST.IVisitor<FormulaType> {
  readonly #fields: ReadonlyMap<string, FormulaType>;
  readonly #locals: ReadonlyMap<string, FormulaType>;
  readonly #probe: SubjectProbe | undefined;
  readonly #errors: FormulaError[] | undefined;
  readonly #closedNames: boolean;

  constructor({ fields, locals = new Map(), probe, errors, closedNames = false }: TypeInferenceOptions) {
    this.#fields = fields;
    this.#locals = locals;
    this.#probe = probe;
    this.#errors = errors;
    this.#closedNames = closedNames;
  }

  typeOf(node: AST.AstNode): FormulaType {
    return node.accept(this);
  }

  visitLiteralNode(node: AST.ILiteralNode): FormulaType {
    if (typeof node.value === 'string') {
      return type.string;
    }

    if (typeof node.value === 'number') {
      return type.number;
    }

    if (typeof node.value === 'boolean') {
      return type.boolean;
    }

    return node.value instanceof RegExp ? type.regexp : type.null;
  }

  visitIdentifierNode(node: AST.IIdentifierNode): FormulaType {
    const found = this.#locals.get(node.name) ?? this.#fields.get(node.name);

    if (!found && this.#closedNames) {
      this.#errors?.push(Errors.Reference.VariableNotDefined.create({ name: node.name }, { location: node.location }));
    }

    return found ?? type.any;
  }

  visitUnaryExpressionNode(node: AST.IUnaryExpressionNode): FormulaType {
    this.typeOf(node.arg);

    return node.operator === '-' ? type.number : type.boolean;
  }

  visitBinaryExpressionNode(node: AST.IBinaryExpressionNode): FormulaType {
    const left = this.typeOf(node.left);
    const right = this.typeOf(node.right);

    switch (node.operator) {
      case '+':
        return sumType(left, right);
      case '-':
      case '*':
      case '/':
      case '^':
      case '%':
        return type.number;
      default:
        return type.boolean;
    }
  }

  visitCallExpressionNode(node: AST.ICallExpressionNode): FormulaType {
    const { callee, args } = node;

    if (callee.type === 'Identifier') {
      return this.#functionResult({ name: callee.name, args, location: node.location });
    }

    const subject = this.typeOf(callee.object);

    if (this.#probe?.method === callee.property) {
      this.#probe.subjects.push(subject);
    }

    return this.#methodResult({ subject, method: callee.property, args });
  }

  visitMemberExpressionNode(node: AST.IMemberExpressionNode): FormulaType {
    return this.typeOf(node.object);
  }

  visitConditionalExpressionNode(node: AST.IConditionalExpressionNode): FormulaType {
    this.typeOf(node.test);

    return unionOf([this.typeOf(node.consequent), this.typeOf(node.alternate)]);
  }

  visitArrayExpressionNode(node: AST.IArrayExpressionNode): FormulaType {
    return { kind: Kind.Array, items: unionOf(node.elements.map((element) => this.typeOf(element))) };
  }

  visitLetExpressionNode(node: AST.ILetExpressionNode): FormulaType {
    // Each value reads the names declared before it
    const scope = node.declarations.reduce<TypeInferenceVisitor>((outer, { name, value }) => outer.#with({ [name.name]: outer.typeOf(value) }), this);

    return scope.typeOf(node.body);
  }

  #with(variables: Readonly<Record<string, FormulaType>>): TypeInferenceVisitor {
    return this.#copy({ locals: new Map([...this.#locals, ...Object.entries(variables)]) });
  }

  /** A scope whose errors are not gathered, for a part evaluation never reaches. */
  #unreached(): TypeInferenceVisitor {
    return this.#copy({ errors: undefined });
  }

  #copy(changes: Partial<Pick<TypeInferenceOptions, 'locals' | 'errors' | 'closedNames'>>): TypeInferenceVisitor {
    return new TypeInferenceVisitor({
      fields: this.#fields,
      locals: this.#locals,
      probe: this.#probe,
      errors: this.#errors,
      closedNames: this.#closedNames,
      ...changes,
    });
  }

  #functionResult({ name, args, location }: { name: string; args: readonly AST.AstNode[]; location: AST.Location }): FormulaType {
    const routine = routinesRegistry.getFunction(name);

    if (!routine) {
      this.#errors?.push(Errors.Reference.FunctionNotDefined.create({ name }, { location }));
      this.#unreached().#readArguments({ args, routines: [] });

      return type.any;
    }

    if (routine.signatures.length === 0) {
      // `parent` reads its argument in the enclosing object, whose names the fields do not list
      (name === 'parent' ? this.#copy({ closedNames: false }) : this).#readArguments({ args, routines: [] });

      return routine.results[0];
    }

    const result = this.#resultOf({ routine, args });
    const failure = result ? this.#literalFailure({ routine, args, location }) : this.#argumentsFailure({ routine, args, location });

    return result && !failure ? result : this.#failedCall({ failures: [failure], args, routines: [routine] });
  }

  /** What `subject.name(args)` gives on each type `subject` may have; a type without such a method gives nothing. */
  #methodResult({ subject, method, args }: { subject: FormulaType; method: AST.IIdentifierNode; args: readonly AST.AstNode[] }): FormulaType {
    const members = membersOf(subject).map((member) => ({ member, ctor: ALL_DATA_TYPES.find(({ kind }) => kind === member.kind) }));
    const results: FormulaType[] = [];
    const failures: (FormulaError | undefined)[] = [];
    const routines: Routine[] = [];

    for (const { member, ctor } of members) {
      if (!ctor) {
        this.#readArguments({ args, routines: methodsNamed(method.name) });

        return type.any;
      }

      const routine = routinesRegistry.getMethod(ctor, method.name);

      if (routine) {
        const result = this.#methodCallResult({ routine, args, subject: member });
        const failure = result ? this.#literalFailure({ routine, args, location: method.location }) : this.#argumentsFailure({ routine, args, location: method.location });

        routines.push(routine);
        results.push(...(result && !failure ? [result] : []));
        failures.push(...(result && !failure ? [] : [failure]));
      }
      else if (member.kind === Kind.Object) {
        // An object reads a field by the name of a method it does not have
        const read = fieldRead({ record: member, method, args });

        results.push(...(read instanceof FormulaError ? [] : [read]));
        failures.push(...(read instanceof FormulaError ? [read] : []));
      }
      else {
        // An empty value fails with an error that points at where the value came from
        failures.push(member.kind === Kind.Null ? undefined : Errors.Reference.MethodNotDefined.create({ name: method.name, target: displayTypeOf(member) }, { location: method.location }));
      }
    }

    return results.length > 0 ? unionOf(results) : this.#failedCall({ failures, args, routines });
  }

  #methodCallResult({ routine, args, subject }: { routine: Routine; args: readonly AST.AstNode[]; subject: FormulaType }): FormulaType | undefined {
    if (routine.signatures.length === 0) {
      this.#readArguments({ args, routines: [] });

      return routine.results[0];
    }

    return this.#resultOf({ routine, args, subject });
  }

  /**
   * Gathers the error of a call that fails on every value, when all of them fail alike, and reads its arguments as the
   * call does before it fails: the values it checks, but none of the expressions evaluated per item.
   */
  #failedCall({ failures, args, routines }: { failures: readonly (FormulaError | undefined)[]; args: readonly AST.AstNode[]; routines: readonly Routine[] }): FormulaType {
    const failure = commonFailure(failures);

    if (failure) {
      this.#errors?.push(failure);
    }

    (routines.length > 0 ? this : this.#unreached()).#readArguments({ args, routines, callbacksReached: false });

    return type.any;
  }

  /**
   * Reads arguments whose types the result does not depend on, each in the scope it is evaluated in: an expression a
   * routine evaluates per item sees the variables it declares, as any value.
   */
  #readArguments({ args, routines, callbacksReached = true }: { args: readonly AST.AstNode[]; routines: readonly Routine[]; callbacksReached?: boolean }): FormulaType {
    for (const [index, arg] of args.entries()) {
      const parameters = routines.flatMap(({ signatures }) => signatures.map((signature) => parameterAt(signature, index)));
      const callbacks = parameters.filter((parameter) => parameter instanceof CallbackArgument);
      const variables = Object.fromEntries(callbacks.flatMap(({ contextVariables }) => contextVariables).map((name) => [name, type.any]));
      const scope = this.#with(variables);
      const evaluated = callbacksReached || callbacks.length === 0 || parameters.some((parameter) => parameter instanceof Argument);

      (evaluated ? scope : scope.#unreached()).typeOf(arg);
    }

    return type.any;
  }

  /** The results of the signatures of `routine` the arguments may fit; `undefined` when they fit none. */
  #resultOf({ routine, args, subject }: { routine: Routine; args: readonly AST.AstNode[]; subject?: FormulaType }): FormulaType | undefined {
    const results = routine.signatures.flatMap((signature, index) => {
      const bindings = new TypeBindings();

      if (subject) {
        bindings.bind(routine.subjects[index] ?? type.any, subject);
      }

      return this.#bindArguments({ signature, args, bindings }) ? [bindings.resolve(routine.results[index])] : [];
    });

    return results.length > 0 ? unionOf(results) : undefined;
  }

  /**
   * Binds the variables of a signature to the types of the arguments of a call, the values before the expressions
   * evaluated per item, which read the variables.
   *
   * @returns `false` when the arguments cannot fit the signature: too few or too many, or a value of no kind it takes.
   */
  #bindArguments({ signature, args, bindings }: { signature: ArgumentsPattern; args: readonly AST.AstNode[]; bindings: TypeBindings }): boolean {
    const repeatable = signature.findLast((parameter) => parameter instanceof Argument && parameter.repeatable);
    const required = signature.filter(({ optional }) => !optional).length;

    if (args.length < required || (args.length > signature.length && !repeatable)) {
      return false;
    }

    const parameters = args.map((_, index) => (index < signature.length ? signature[index] : repeatable));

    for (const [index, parameter] of parameters.entries()) {
      if (parameter instanceof Argument) {
        const argument = this.typeOf(args[index]);

        if (!mayHaveKind(argument, parameter.kinds)) {
          return false;
        }

        bindings.bind(parameter.type, argument);
      }
    }

    for (const [index, parameter] of parameters.entries()) {
      if (parameter instanceof CallbackArgument) {
        const variables = Object.fromEntries(parameter.contextVariables.map((name) => [name, bindings.resolve(parameter.variableTypes[name] ?? type.any)]));

        bindings.bind(parameter.returns, this.#with(variables).typeOf(args[index]));
      }
    }

    return true;
  }

  /** The error a call whose arguments have kinds a signature takes fails with on a word or a pattern written in it. */
  #literalFailure({ routine, args, location }: { routine: Routine; args: readonly AST.AstNode[]; location: AST.Location }): FormulaError | undefined {
    const checksLiteral = args.some((arg, index) => arg.type === 'Literal' && routine.signatures.some((signature) => {
      const parameter = parameterAt(signature, index);

      return parameter instanceof Argument && parameter.validation !== undefined;
    }));

    return checksLiteral ? this.#argumentsFailure({ routine, args, location }) : undefined;
  }

  /**
   * The error the check of the arguments of `routine` raises on every value of their types, found by running the check
   * on one value of each kind they may have.
   *
   * @returns `undefined` when the error may depend on the values: an argument of any type, a value a check of its own
   * reads, too many kinds to try, kinds that fail differently, or an error that points at where a value came from,
   * which may be a part of the argument.
   */
  #argumentsFailure({ routine, args, location }: { routine: Routine; args: readonly AST.AstNode[]; location: AST.Location }): FormulaError | undefined {
    const silent = this.#unreached();
    const choices = args.map((arg, index): readonly FormulaDataType[] | undefined => {
      if (arg.type === 'Literal') {
        return [convertValueToFormulaType(arg.value)];
      }

      const kinds = kindsOf(silent.typeOf(arg));
      const checked = routine.signatures.some((signature) => {
        const parameter = parameterAt(signature, index);

        return parameter instanceof Argument && parameter.validation !== undefined && kinds.some((kind) => parameter.kinds.includes(kind) || kind === Kind.Any);
      });

      return checked ? undefined : representativesOf(kinds);
    });
    const combinations = combine(choices);
    const errors = combinations?.map((values) => routine.argumentsError({
      args,
      visitor: CHECK_VISITOR,
      valueOf: (node) => new ProcessedArgument(values[args.indexOf(node)], node),
      location,
    }));
    const failure = errors && commonFailure(errors);
    const pointsInside = failure?.location !== undefined && args.some((arg) => !OWN_ORIGIN.has(arg.type) && sameLocation(arg.location, failure.location));

    return pointsInside ? undefined : failure;
  }
}

/** The routines of the name on every type of value, for a method called on a value of any type. */
function methodsNamed(name: string): Routine[] {
  return routinesRegistry.getRegisteredDataTypes().flatMap((ctor) => routinesRegistry.getMethod(ctor, name) ?? []);
}

function parameterAt(signature: ArgumentsPattern, index: number): Argument | CallbackArgument | undefined {
  return index < signature.length ? signature[index] : signature.findLast((parameter) => parameter instanceof Argument && parameter.repeatable);
}

/** One value of each kind, or `undefined` when a kind is any kind. */
function representativesOf(kinds: readonly Kind[]): FormulaDataType[] | undefined {
  const values = kinds.map((kind) => representativeValue(kind === Kind.Array ? { kind, items: type.any } : { kind }));

  return values.every((value) => value !== undefined) ? values : undefined;
}

/** Every way to take one value per argument, or `undefined` when an argument has no values or there are too many ways. */
function combine(choices: readonly (readonly FormulaDataType[] | undefined)[]): FormulaDataType[][] | undefined {
  return choices.reduce<FormulaDataType[][] | undefined>((combinations, values) => {
    if (!combinations || !values || combinations.length * values.length > MAX_KIND_COMBINATIONS) {
      return undefined;
    }

    return combinations.flatMap((combination) => values.map((value) => [...combination, value]));
  }, [[]]);
}

/**
 * The error every value fails with, when they all fail alike; values that lack a method or a field differ only in the
 * type the error names, so their error names all of them.
 */
function commonFailure(failures: readonly (FormulaError | undefined)[]): FormulaError | undefined {
  const [first] = failures;
  const errors = failures.filter((failure) => failure !== undefined);

  if (!first || errors.length < failures.length || !errors.every((error) => error.messageKey === first.messageKey && sameLocation(error.location, first.location))) {
    return undefined;
  }

  if (errors.every((error) => JSON.stringify(error.payload) === JSON.stringify(first.payload))) {
    return first;
  }

  const definition = [Errors.Reference.MethodNotDefined, Errors.Reference.FieldNotDefined].find((candidate) => candidate.is(first));
  const references = errors.filter((error): error is FormulaError<'REFERENCE_ERROR'> => error.code === 'REFERENCE_ERROR');

  if (!definition || references.length < errors.length) {
    return undefined;
  }

  const targets = [...new Set(references.map(({ payload }) => payload.target))].join(' or ');

  return definition.create({ name: references[0].payload.name, target: targets }, { location: first.location });
}

function sameLocation(left: AST.Location | undefined, right: AST.Location | undefined): boolean {
  return left?.start.offset === right?.start.offset && left?.end.offset === right?.end.offset;
}

/** What `record.name(args)` reads from a record without a method of that name, or the error the read fails with. */
function fieldRead({ record, method, args }: { record: FormulaType & { kind: typeof Kind.Object }; method: AST.IIdentifierNode; args: readonly AST.AstNode[] }): FormulaType | FormulaError {
  const field = record.fields?.find((candidate) => candidate.name === method.name);

  if (!record.fields) {
    return type.any;
  }

  if (!field) {
    return Errors.Reference.FieldNotDefined.create({ name: method.name, target: displayTypeOf(record) }, { location: method.location });
  }

  return args.length > 0 ? Errors.Argument.ExactCount.create({ actual: args.length, expected: 0 }, { location: method.location }) : field.type ?? type.any;
}

/** How an error names the type of a value of `formulaType`. */
function displayTypeOf(formulaType: FormulaType): string | undefined {
  return representativeValue(formulaType)?.displayType;
}

/** The type of `left + right`: text when either is text, a number when both are numbers. */
function sumType(left: FormulaType, right: FormulaType): FormulaType {
  const results = membersOf(left).flatMap((l) => membersOf(right).flatMap((r) => {
    if (l.kind === Kind.Any || r.kind === Kind.Any) {
      return [type.string, type.number];
    }

    if (l.kind === Kind.String || r.kind === Kind.String) {
      return [type.string];
    }

    return l.kind === Kind.Number && r.kind === Kind.Number ? [type.number] : [];
  }));

  return unionOf(results);
}

/** Tells whether a value of `formulaType` may be of one of `kinds`, as a call checks an argument. */
function mayHaveKind(formulaType: FormulaType, kinds: readonly Kind[]): boolean {
  return kinds.includes(Kind.Any) || membersOf(formulaType).some(({ kind }) => kind === Kind.Any || (kinds as readonly string[]).includes(kind));
}
