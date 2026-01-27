import { FormulaBoolean, FormulaString } from '../../data-types';
import { ArgumentFormulaError } from '../../errors';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('1 > 0', 'true', 'false'),
    result: () => new FormulaBoolean(true),
  },
  {
    formula: (name) => name('"a" == "b"', '"Equal"', '"Not Equal"'),
    result: () => new FormulaString('Not Equal'),
  },
]);

routinesRegistry.registerFunction('if', {
  description: 'Returns the first value if the condition is true; otherwise, returns the second value.',
  examples: routineExamples,
  handler: ({ node, visitor }) => {
    // Use simple inline validation to avoid evaluate all static args
    if (node.args.length !== 3) {
      throw new ArgumentFormulaError(
        'Expected 3 arguments.',
        {
          location: node.location,
          context: {
            expected: 3,
            actual: node.args.length,
          },
        },
      );
    }

    const [condNode, trueNode, falseNode] = node.args;
    const condVal = visitor.evaluateNode(condNode);

    const truthy = !condVal.isEmpty();
    const branchNode = truthy ? trueNode : falseNode;
    return visitor.evaluateNode(branchNode);
  },
});
