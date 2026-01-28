import type { AST } from '../../parser';
import type { FormulaEvaluatorVisitor } from '../evaluator.visitor';
import type { ArgumentsPattern, ProcessedArguments } from './arguments';
import type { RoutineExample } from './routine-example';

import { AstNodes } from '../../parser';
import { FormulaDataType } from '../data-types';
import { ArgumentsProcessor, CallbackExecutor, ProcessedArgument, RoutineArguments } from './arguments';

interface ContextUtils {
  flatArgs: (args: AST.AstNode[] | ProcessedArguments) => AST.AstNode[];
}

interface FormulaDataTypeRoutineHandlerContext<TInstance extends FormulaDataType | unknown> {
  instance: TInstance;
  args: ProcessedArguments;
  visitor: FormulaEvaluatorVisitor;
  location: AST.Location;
  utils: ContextUtils;
}

interface GlobalRoutineHandlerContext {
  node: AST.ICallExpressionNode;
  args: ProcessedArguments | undefined;
  visitor: FormulaEvaluatorVisitor;
  location: AST.Location;
  utils: ContextUtils;
}

export type RoutineHandlerContext<TInstance extends FormulaDataType | unknown> = TInstance extends FormulaDataType
  ? FormulaDataTypeRoutineHandlerContext<TInstance>
  : GlobalRoutineHandlerContext;

export type RoutineHandler<TInstance extends FormulaDataType | unknown> = (context: RoutineHandlerContext<TInstance>) => FormulaDataType;

export interface RoutineExecuteParams<TInstance extends FormulaDataType | unknown> {
  instance: TInstance;
  node: AST.ICallExpressionNode;
  visitor: FormulaEvaluatorVisitor;
  location: AST.Location;
}

export interface RoutineOptions<TInstance extends Routine | FormulaDataType | unknown = unknown> {
  readonly description: string;
  readonly examples: RoutineExample[];
  readonly arguments?: ArgumentsPattern | readonly ArgumentsPattern[] | RoutineArguments;
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
    const args = options.arguments instanceof RoutineArguments ? options.arguments.alternatives : options.arguments;
    this.#argumentsProcessor = args ? new ArgumentsProcessor(args) : undefined;
    this.#handler = options.handler;
  }

  execute(params: RoutineExecuteParams<TInstance>) {
    const { instance, node, visitor, location } = params;

    const processedArgs = this.#process(node.args, visitor);

    this.#validate(processedArgs, location);

    const utils = this.#buildContextUtils();

    if (instance instanceof FormulaDataType) {
      const context = {
        instance,
        args: processedArgs || node.args.map((arg) => new ProcessedArgument(visitor.evaluateNode(arg), arg)),
        visitor,
        location,
        utils,
      } satisfies FormulaDataTypeRoutineHandlerContext<FormulaDataType>;

      return this.#handler(context as RoutineHandlerContext<TInstance>);
    }

    const context = {
      node,
      args: processedArgs,
      visitor,
      location,
      utils,
    } satisfies GlobalRoutineHandlerContext;

    return this.#handler(context as RoutineHandlerContext<TInstance>);
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

  #buildContextUtils(): ContextUtils {
    function flatArgs(args: AST.AstNode[] | ProcessedArguments): AST.AstNode[] {
      return args.flatMap((arg) => {
        const node = arg instanceof ProcessedArgument ? arg.node : arg instanceof CallbackExecutor ? arg.node : arg;
        return node instanceof AstNodes.ArrayExpressionNode ? flatArgs(node.elements) : node;
      });
    }

    return {
      flatArgs,
    };
  }
}
