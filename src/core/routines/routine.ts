import type { AST } from '../../parser';
import type { FormulaError } from '../errors';
import type { FormulaEvaluatorVisitor } from '../evaluator.visitor';
import type { FormulaType } from '../types';
import type { ArgumentsPattern, CallArguments, ProcessedArguments, Signatures, SubjectCalls, SubjectSignatures } from './arguments';
import type { RoutineExample } from './routine-example';

import { FormulaDataType } from '../data-types';
import { ArgumentsProcessor, CallbackArgument, ProcessedArgument } from './arguments';

interface FormulaDataTypeRoutineHandlerContext<TInstance extends FormulaDataType | unknown> {
  instance: TInstance;
  args: ProcessedArguments;
  visitor: FormulaEvaluatorVisitor;
  location: AST.Location;
}

interface GlobalRoutineHandlerContext {
  node: AST.ICallExpressionNode;
  args: ProcessedArguments | undefined;
  visitor: FormulaEvaluatorVisitor;
  location: AST.Location;
}

export type RoutineHandlerContext<TInstance extends FormulaDataType | unknown> = TInstance extends FormulaDataType
  ? FormulaDataTypeRoutineHandlerContext<TInstance>
  : GlobalRoutineHandlerContext;

export type RoutineHandler<TInstance extends FormulaDataType | unknown> = (context: RoutineHandlerContext<TInstance>) => FormulaDataType;

/** Context of a routine registered for both forms: `subject` is `x` in `f(x, a)` and in `x.f(a)`, `args` are the rest. */
export type SubjectRoutineHandlerContext<TSignatures extends SubjectSignatures> = SubjectCalls<TSignatures> & {
  /** Location of each element of `args`, for errors that point at the argument at fault. */
  readonly locations: readonly AST.Location[];
  readonly visitor: FormulaEvaluatorVisitor;
  readonly location: AST.Location;
};

export type SubjectRoutineHandler<TSignatures extends SubjectSignatures, TResult extends FormulaDataType = FormulaDataType> = (context: SubjectRoutineHandlerContext<TSignatures>) => TResult;

/** Context of a function-only routine; without declared arguments it reads the call syntax from `node` itself. */
export interface FunctionRoutineHandlerContext<TSignatures extends Signatures | undefined> {
  readonly node: AST.ICallExpressionNode;
  readonly args: TSignatures extends Signatures ? CallArguments<TSignatures> : undefined;
  readonly visitor: FormulaEvaluatorVisitor;
  readonly location: AST.Location;
}

export type FunctionRoutineHandler<TSignatures extends Signatures | undefined, TResult extends FormulaDataType = FormulaDataType> = (context: FunctionRoutineHandlerContext<TSignatures>) => TResult;

/** Context of a method-only routine: `instance` is the value before the dot, `args` are those in the parentheses. */
export interface MethodRoutineHandlerContext<TInstance extends FormulaDataType, TSignatures extends Signatures | undefined> {
  readonly instance: TInstance;
  readonly args: TSignatures extends Signatures ? CallArguments<TSignatures> : FormulaDataType[];
  readonly visitor: FormulaEvaluatorVisitor;
  readonly location: AST.Location;
}

export type MethodRoutineHandler<TInstance extends FormulaDataType, TSignatures extends Signatures | undefined, TResult extends FormulaDataType = FormulaDataType> = (
  context: MethodRoutineHandlerContext<TInstance, TSignatures>,
) => TResult;

export interface RoutineExecuteParams<TInstance extends FormulaDataType | unknown> {
  instance: TInstance;
  node: AST.ICallExpressionNode;
  visitor: FormulaEvaluatorVisitor;
  location: AST.Location;
}

export interface RoutineOptions<TInstance extends Routine | FormulaDataType | unknown = unknown> {
  readonly description: string;
  readonly examples: RoutineExample[];
  readonly arguments?: ArgumentsPattern | readonly ArgumentsPattern[];
  /** The type of the result of each signature, in their order; one type when the routine checks its arguments itself. */
  readonly results: readonly FormulaType[];
  /** For a method form, the type of the value it is called on with each signature, in their order. */
  readonly subjects?: readonly FormulaType[];
  /** The routine is a method form whose subject every signature accepts, so a failed call reports the same signature as the function form. */
  readonly subjectAccepted?: boolean;
  /** The routine is a function form whose first argument is the call subject, so a failed call reports the signatures its method form has on that type. */
  readonly subjectFirst?: boolean;
  /** The result can differ between calls with the same arguments. */
  readonly volatile?: boolean;
  readonly handler: RoutineHandler<TInstance>;
}

export class Routine<TInstance extends Routine | FormulaDataType | unknown = unknown> {
  readonly description: string;
  readonly examples: RoutineExample[];
  /** The result can differ between calls with the same arguments, so formulas calling it are never skipped as unchanged. */
  readonly volatile: boolean;
  /** The type of the result of each of {@link Routine.signatures}, in their order; one type when there are none. */
  readonly results: readonly FormulaType[];
  /** The type of the value a method form is called on with each of {@link Routine.signatures}; empty for a function. */
  readonly subjects: readonly FormulaType[];
  readonly #argumentsProcessor?: ArgumentsProcessor;
  readonly #handler: RoutineHandler<TInstance>;

  constructor(options: RoutineOptions<TInstance>) {
    this.description = options.description;
    this.examples = options.examples;
    this.volatile = options.volatile ?? false;
    this.results = options.results;
    this.subjects = options.subjects ?? [];
    this.#argumentsProcessor = options.arguments ? new ArgumentsProcessor(options.arguments, { precedingMatches: options.subjectAccepted ? 1 : 0, subjectFirst: options.subjectFirst }) : undefined;
    this.#handler = options.handler;
  }

  /** Argument lists the routine accepts, one per alternative; empty when its arguments are not checked. */
  get signatures(): readonly ArgumentsPattern[] {
    return this.#argumentsProcessor?.definitions.alternatives ?? [];
  }

  execute(params: RoutineExecuteParams<TInstance>) {
    const { instance, node, visitor, location } = params;

    const processedArgs = this.#process(node.args, visitor);

    this.#validate(processedArgs, location);

    if (instance instanceof FormulaDataType) {
      const context = {
        instance,
        args: processedArgs || node.args.map((arg) => new ProcessedArgument(visitor.evaluateNode(arg), arg, visitor.origin)),
        visitor,
        location,
      } satisfies FormulaDataTypeRoutineHandlerContext<FormulaDataType>;

      return this.#handler(context as RoutineHandlerContext<TInstance>);
    }

    const context = {
      node,
      args: processedArgs,
      visitor,
      location,
    } satisfies GlobalRoutineHandlerContext;

    return this.#handler(context as RoutineHandlerContext<TInstance>);
  }

  /**
   * Names a callback at this argument position adds to its scope, such as `current` and `index`.
   *
   * @remarks
   * Empty unless every signature takes a callback at this position; with several signatures,
   * only the names all of them declare.
   */
  getCallbackVariables(argumentIndex: number): readonly string[] {
    const definitions = this.#argumentsProcessor?.definitions;

    if (!definitions || definitions.alternatives.length === 0) {
      return [];
    }

    const callbacks = definitions.alternatives.map((pattern) => definitions.getArgumentForPattern(argumentIndex, pattern));

    if (!callbacks.every((argument) => argument instanceof CallbackArgument)) {
      return [];
    }

    const [first, ...rest] = callbacks;

    return first.contextVariables.filter((name) => rest.every((callback) => callback.contextVariables.includes(name)));
  }

  #process(
    args: AST.AstNode[],
    visitor: FormulaEvaluatorVisitor,
  ): ProcessedArguments | undefined {
    if (!this.#argumentsProcessor) {
      return;
    }

    return this.#argumentsProcessor.process(args, visitor);
  }

  /**
   * The error a call fails with before the routine runs, with the value of each value argument from `valueOf` in place
   * of evaluating it.
   *
   * @returns `undefined` when the arguments fit a signature, or the routine checks its arguments itself.
   */
  argumentsError({ args, visitor, valueOf, location }: {
    args: readonly AST.AstNode[];
    visitor: FormulaEvaluatorVisitor;
    valueOf: (node: AST.AstNode) => ProcessedArgument;
    location: AST.Location;
  }): FormulaError | undefined {
    const processedArgs = this.#argumentsProcessor?.processWith({ args, visitor, valueOf });

    return processedArgs && this.#errorOf(processedArgs, location);
  }

  #validate(
    processedArgs: ProcessedArguments | undefined,
    location: AST.Location,
  ): void {
    const error = processedArgs && this.#errorOf(processedArgs, location);

    if (error) {
      throw error;
    }
  }

  #errorOf(processedArgs: ProcessedArguments, location: AST.Location): FormulaError | undefined {
    if (!this.#argumentsProcessor || this.#argumentsProcessor.validate(processedArgs)) {
      return undefined;
    }

    return this.#argumentsProcessor.getValidationError(processedArgs, location);
  }
}
