import type { AST } from '../parser';
import type { ArgumentsPattern } from './routines/arguments';
import type { Routine } from './routines/routine';
import type { FormulaType } from './types';

import { ALL_DATA_TYPES, Kind } from './data-types';
import { Argument, CallbackArgument } from './routines/arguments';
import { routinesRegistry } from './routines/registry';
import { membersOf, type, TypeBindings, unionOf } from './types';

interface InferTypeOptions {
  /** The parsed formula. */
  readonly formula: AST.AstNode;
  /** The types of the names the formula reads from its record; a name left out holds any value. */
  readonly fields: ReadonlyMap<string, FormulaType>;
}

/**
 * The type of what a formula evaluates to on any record whose fields have the types of `fields`.
 *
 * @remarks
 * The type never leaves out a value the evaluation can give, so it errs wider where the formula alone does not
 * tell: a name the record has no type for, a routine that reads its arguments itself, such as `if`, and a field read
 * of an object hold any value. An expression that always fails, such as `"a" * 2`, may be given any type.
 */
export function inferType({ formula, fields }: InferTypeOptions): FormulaType {
  return new TypeInferenceVisitor(fields, new Map()).typeOf(formula);
}

/** Infers the type of a node with the names in scope where it stands: local ones first, then the fields. */
class TypeInferenceVisitor implements AST.IVisitor<FormulaType> {
  readonly #fields: ReadonlyMap<string, FormulaType>;
  readonly #locals: ReadonlyMap<string, FormulaType>;

  constructor(fields: ReadonlyMap<string, FormulaType>, locals: ReadonlyMap<string, FormulaType>) {
    this.#fields = fields;
    this.#locals = locals;
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
    return node.operator === '-' ? type.number : type.boolean;
  }

  visitBinaryExpressionNode(node: AST.IBinaryExpressionNode): FormulaType {
    switch (node.operator) {
      case '+':
        return sumType(this.typeOf(node.left), this.typeOf(node.right));
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

      return (routine && this.#resultOf({ routine, args })) ?? type.any;
    }

    return this.#methodResult({ subject: this.typeOf(callee.object), name: callee.property.name, args });
  }

  visitMemberExpressionNode(node: AST.IMemberExpressionNode): FormulaType {
    return this.typeOf(node.object);
  }

  visitConditionalExpressionNode(node: AST.IConditionalExpressionNode): FormulaType {
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
    return new TypeInferenceVisitor(this.#fields, new Map([...this.#locals, ...Object.entries(variables)]));
  }

  /** What `subject.name(args)` gives on each type `subject` may have; a type without such a method gives nothing. */
  #methodResult({ subject, name, args }: { subject: FormulaType; name: string; args: readonly AST.AstNode[] }): FormulaType {
    const results: FormulaType[] = [];

    for (const member of membersOf(subject)) {
      const ctor = ALL_DATA_TYPES.find(({ kind }) => kind === member.kind);

      if (!ctor) {
        return type.any;
      }

      const routine = routinesRegistry.getMethod(ctor, name);
      const result = routine ? this.#resultOf({ routine, args, subject: member }) : undefined;

      if (result) {
        results.push(result);
      }
      else if (!routine && member.kind === Kind.Object) {
        // An object reads a field by the name of a method it does not have
        results.push(type.any);
      }
    }

    return results.length > 0 ? unionOf(results) : type.any;
  }

  /** The results of the signatures of `routine` the arguments may fit; `undefined` when they fit none. */
  #resultOf({ routine, args, subject }: { routine: Routine; args: readonly AST.AstNode[]; subject?: FormulaType }): FormulaType | undefined {
    if (routine.signatures.length === 0) {
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
