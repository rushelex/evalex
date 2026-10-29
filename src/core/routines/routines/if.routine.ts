import type { RoutineExampleOptions } from '../routine-example';

import { FormulaBoolean, FormulaString } from '../../data-types';
import { Errors } from '../../errors';
import { type } from '../../types';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('1 > 0', 'true', 'false'),
    result: () => new FormulaBoolean(true),
  },
  {
    formula: (name) => name('"a" == "b"', '"Equal"', '"Not Equal"'),
    result: () => new FormulaString('Not Equal'),
  },
];

routinesRegistry.registerFunction('if', {
  description: 'Returns the first value if the condition is true, or the second.',
  examples: routineExamples,
  returns: type.any,
  handler: ({ node, visitor }) => {
    // Use simple inline validation to avoid evaluate all static args
    if (node.args.length !== 3) {
      throw Errors.Argument.ExactCount.create(
        { actual: node.args.length, expected: 3 },
        { location: node.location },
      );
    }

    const [condNode, trueNode, falseNode] = node.args;
    const condVal = visitor.evaluateNode(condNode);

    const truthy = !condVal.isEmpty();
    const branchNode = truthy ? trueNode : falseNode;
    return visitor.evaluateNode(branchNode);
  },
});
