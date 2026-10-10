import type { AST } from '../../parser';
import type { FormulaEvaluatorVisitor } from '../evaluator.visitor';
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

export type SubjectRoutineHandler<TSignatures extends SubjectSignatures> = (context: SubjectRoutineHandlerContext<TSignatures>) => FormulaDataType;

/** Context of a function-only routine; without declared arguments it reads the call syntax from `node` itself. */
export interface FunctionRoutineHandlerContext<TSignatures extends Signatures | undefined> {
  readonly node: AST.ICallExpressionNode;
  readonly args: TSignatures extends Signatures ? CallArguments<TSignatures> : undefined;
  readonly visitor: FormulaEvaluatorVisitor;
  readonly location: AST.Location;
}

export type FunctionRoutineHandler<TSignatures extends Signatures | undefined> = (context: FunctionRoutineHandlerContext<TSignatures>) => FormulaDataType;

/** Context of a method-only routine: `instance` is the value before the dot, `args` are those in the parentheses. */
export interface MethodRoutineHandlerContext<TInstance extends FormulaDataType, TSignatures extends Signatures | undefined> {
  readonly instance: TInstance;
  readonly args: TSignatures extends Signatures ? CallArguments<TSignatures> : FormulaDataType[];
  readonly visitor: FormulaEvaluatorVisitor;
  readonly location: AST.Location;
}

export type MethodRoutineHandler<TInstance extends FormulaDataType, TSignatures extends Signatures | undefined> = (context: MethodRoutineHandlerContext<TInstance, TSignatures>) => FormulaDataType;

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
  /** The routine is a method form whose subject every signature accepts, so a failed call reports the same signature as the function form. */
  readonly subjectAccepted?: boolean;
  readonly handler: RoutineHandler<TInstance>;
}

export class Routine<TInstance extends Routine | FormulaDataType | unknown = unknown> {
  readonly description: string;
  readonly examples: RoutineExample[];
  readonly #argumentsProcessor?: ArgumentsProcessor;
  readonly #handler: RoutineHandler<TInstance>;

  constructor(options: RoutineOptions<TInstance>) {
    this.description = options.description;
    this.examples = options.examples;
    this.#argumentsProcessor = options.arguments ? new ArgumentsProcessor(options.arguments, { precedingMatches: options.subjectAccepted ? 1 : 0 }) : undefined;
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
        args: processedArgs || node.args.map((arg) => new ProcessedArgument(visitor.evaluateNode(arg), arg)),
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

  #validate(
    processedArgs: ProcessedArguments | undefined,
    location: AST.Location,
  ): void {
    if (!this.#argumentsProcessor) {
      return;
    }

    if (!processedArgs || this.#argumentsProcessor.validate(processedArgs)) {
      return;
    }

    throw this.#argumentsProcessor.getValidationError(processedArgs, location);
  }
}
