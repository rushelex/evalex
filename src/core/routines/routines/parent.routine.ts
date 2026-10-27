import type { GlobalProperties } from '../../context';
import type { FormulaDataType } from '../../data-types';
import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { Errors } from '../../errors';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('2 * 3'),
    result: () => new FormulaNumber(6),
  },
  {
    formula: () => 'parent(rate, 1)',
    error: {
      type: Errors.Argument.ExactCount,
      message: 'Expected 1 argument.',
      location: { function: [0, 15] },
    },
  },
];

/** Names of no record, for a formula whose names do not come from records, such as one evaluated by name. */
const NO_NAMES: GlobalProperties = new Map<string, FormulaDataType>();

routinesRegistry.registerFunction('parent', {
  description: 'Evaluates the expression over the fields of the enclosing object.',
  examples: routineExamples,
  handler: ({ node, visitor }) => {
    // The expression is evaluated over other names, so the arguments are not evaluated ahead of the call.
    if (node.args.length !== 1) {
      throw Errors.Argument.ExactCount.create({ actual: node.args.length, expected: 1 }, { location: node.location });
    }

    const enclosing = visitor.context.globalProperties.enclosing?.() ?? NO_NAMES;

    return visitor.cloneWithContext(visitor.context.withGlobalProperties(enclosing)).evaluateNode(node.args[0]);
  },
});
