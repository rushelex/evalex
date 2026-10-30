import type { FunctionRoutineHandler } from '../routine';

import { Errors } from '../../errors';

/**
 * Handles `previous` and `next`: evaluates the expression over the record next to the formula's record in its list, or
 * the default, over the formula's own record, where there is no such record.
 */
export function neighborHandler(offset: -1 | 1): FunctionRoutineHandler<undefined> {
  return ({ node, visitor }) => {
    // Only one of the two arguments is evaluated, so they are not evaluated ahead of the call.
    if (node.args.length !== 2) {
      throw Errors.Argument.ExactCount.create({ actual: node.args.length, expected: 2 }, { location: node.location });
    }

    const [expression, fallback] = node.args;
    const neighbor = visitor.context.globalProperties.neighbor?.(offset);

    if (!neighbor) {
      return visitor.evaluateNode(fallback);
    }

    return visitor.cloneWithContext(visitor.context.withGlobalProperties(neighbor)).evaluateNode(expression);
  };
}
