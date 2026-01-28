import type { Class } from 'type-fest';

import type { AST } from '../../parser';
import type { FormulaDataType } from '../data-types';
import type { FormulaEvaluatorVisitor } from '../evaluator.visitor';

import { FormulaObject } from '../data-types';
import { ArgumentFormulaError, ReferenceFormulaError } from '../errors';
import { routinesRegistry } from './registry';

export type MethodResolveResult = { handled: true; result: FormulaDataType } | { handled: false };

export type MethodResolver = (
  instance: FormulaDataType,
  methodNode: AST.IIdentifierNode,
  callNode: AST.ICallExpressionNode,
  visitor: FormulaEvaluatorVisitor,
) => MethodResolveResult;

export class RoutineDispatcher {
  readonly #resolvers: readonly MethodResolver[];

  constructor(resolvers?: readonly MethodResolver[]) {
    this.#resolvers = resolvers ?? [
      this.#staticMethodResolver.bind(this),
      this.#dynamicObjectFieldResolver.bind(this),
    ];
  }

  callFunction(functionName: string, node: AST.ICallExpressionNode, visitor: FormulaEvaluatorVisitor) {
    const fn = routinesRegistry.getFunction(functionName);

    if (!fn) {
      throw new ReferenceFormulaError(
        `Function "${functionName}" is not defined.`,
        {
          location: node.location,
          context: {
            name: functionName,
            type: 'function',
          },
        },
      );
    }

    return fn.execute({
      instance: fn,
      node,
      visitor,
      location: node.location,
    });
  }

  callMethod(
    instance: FormulaDataType,
    methodNode: AST.IIdentifierNode,
    node: AST.ICallExpressionNode,
    visitor: FormulaEvaluatorVisitor,
  ) {
    for (const resolver of this.#resolvers) {
      const res = resolver(instance, methodNode, node, visitor);
      if (res.handled) {
        return res.result;
      }
    }

    throw new ReferenceFormulaError(
      `Method "${methodNode.name}" is not defined.`,
      {
        location: methodNode.location,
        context: {
          name: methodNode.name,
          type: 'method',
          target: instance.displayType,
        },
      },
    );
  }

  #staticMethodResolver(
    instance: FormulaDataType,
    methodNode: AST.IIdentifierNode,
    node: AST.ICallExpressionNode,
    visitor: FormulaEvaluatorVisitor,
  ): MethodResolveResult {
    const ctor = instance.constructor as Class<FormulaDataType>;
    const method = routinesRegistry.getMethod(ctor, methodNode.name);
    if (!method) {
      return { handled: false };
    }

    const result = method.execute({
      instance,
      node,
      visitor,
      location: methodNode.location,
    });

    return { handled: true, result };
  }

  #dynamicObjectFieldResolver(
    instance: FormulaDataType,
    methodNode: AST.IIdentifierNode,
    node: AST.ICallExpressionNode,
  ): MethodResolveResult {
    if (!(instance instanceof FormulaObject)) {
      return { handled: false };
    }

    const fieldName = methodNode.name;

    if (!Object.prototype.hasOwnProperty.call(instance.value, fieldName)) {
      throw new ReferenceFormulaError(
        `Field "${fieldName}" is not defined.`,
        {
          location: methodNode.location,
          context: {
            name: fieldName,
            type: 'method',
            target: instance.displayType,
          },
        },
      );
    }

    if (node.args.length > 0) {
      throw new ArgumentFormulaError(
        `Expected 0 arguments.`,
        {
          location: methodNode.location,
          context: {
            expected: 0,
            actual: node.args.length,
          },
        },
      );
    }

    return { handled: true, result: (instance.value as Record<string, FormulaDataType>)[fieldName] };
  }
}

export const routineDispatcher = new RoutineDispatcher();
