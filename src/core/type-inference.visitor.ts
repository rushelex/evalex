import type { AST } from '../parser';
import type { ArgumentsPattern } from './routines/arguments';
import type { Routine } from './routines/routine';
import type { FormulaType } from './types';

import { ALL_DATA_TYPES, Kind } from './data-types';
import { Argument, CallbackArgument } from './routines/arguments';
import { routinesRegistry } from './routines/registry';
import { membersOf, type, TypeBindings, unionOf } from './types';

interface TypeInferenceOptions {
  /** The types of the names the formula reads from its record. */
  readonly fields: ReadonlyMap<string, FormulaType>;
  /** The types of the names the formula declares around the node, which hide the fields. */
  readonly locals?: ReadonlyMap<string, FormulaType>;
  /** Gathers the types of the value a method call is read on, in every scope it is read in. */
  readonly probe?: SubjectProbe;
}

interface SubjectProbe {
  /** The method name of the call, as the parser read it. */
  readonly method: AST.IIdentifierNode;
  readonly subjects: FormulaType[];
}

/**
 * Infers the type of a node with the names in scope where it stands: local ones first, then the fields.
 *
 * @remarks
 * Reads every argument of a call at least once, also where the type of the call does not depend on it, so a probe
 * finds a method call wherever it stands.
 */
export class TypeInferenceVisitor implements AST.IVisitor<FormulaType> {
  readonly #fields: ReadonlyMap<string, FormulaType>;
  readonly #locals: ReadonlyMap<string, FormulaType>;
  readonly #probe: SubjectProbe | undefined;

  constructor({ fields, locals = new Map(), probe }: TypeInferenceOptions) {
    this.#fields = fields;
    this.#locals = locals;
    this.#probe = probe;
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
    return this.#locals.get(node.name) ?? this.#fields.get(node.name) ?? type.any;
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
      const routine = routinesRegistry.getFunction(callee.name);

      return (routine && this.#resultOf({ routine, args })) ?? this.#unread(args);
    }

    const subject = this.typeOf(callee.object);

    if (this.#probe?.method === callee.property) {
      this.#probe.subjects.push(subject);
    }

    return this.#methodResult({ subject, name: callee.property.name, args });
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
    return new TypeInferenceVisitor({ fields: this.#fields, locals: new Map([...this.#locals, ...Object.entries(variables)]), probe: this.#probe });
  }

  /** Reads arguments whose types the result does not depend on, for the probe, and gives any type. */
  #unread(args: readonly AST.AstNode[]): FormulaType {
    for (const arg of args) {
      this.typeOf(arg);
    }

    return type.any;
  }

  /** What `subject.name(args)` gives on each type `subject` may have; a type without such a method gives nothing. */
  #methodResult({ subject, name, args }: { subject: FormulaType; name: string; args: readonly AST.AstNode[] }): FormulaType {
    const results: FormulaType[] = [];

    for (const member of membersOf(subject)) {
      const ctor = ALL_DATA_TYPES.find(({ kind }) => kind === member.kind);

      if (!ctor) {
        return this.#unread(args);
      }

      const routine = routinesRegistry.getMethod(ctor, name);
      const result = routine ? this.#resultOf({ routine, args, subject: member }) : undefined;

      if (result) {
        results.push(result);
      }
      else if (!routine && member.kind === Kind.Object) {
        // An object reads a field by the name of a method it does not have
        results.push(...fieldRead({ record: member, name, args }));
      }
    }

    return results.length > 0 ? unionOf(results) : this.#unread(args);
  }

  /** The results of the signatures of `routine` the arguments may fit; `undefined` when they fit none. */
  #resultOf({ routine, args, subject }: { routine: Routine; args: readonly AST.AstNode[]; subject?: FormulaType }): FormulaType | undefined {
    if (routine.signatures.length === 0) {
      this.#unread(args);

      return routine.results[0];
    }

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
}

/** What `record.name(args)` reads from a record without a method of that name: nothing when the read fails. */
function fieldRead({ record, name, args }: { record: FormulaType & { kind: typeof Kind.Object }; name: string; args: readonly AST.AstNode[] }): FormulaType[] {
  if (!record.fields) {
    return [type.any];
  }

  const field = record.fields.find((candidate) => candidate.name === name);

  return field && args.length === 0 ? [field.type ?? type.any] : [];
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
