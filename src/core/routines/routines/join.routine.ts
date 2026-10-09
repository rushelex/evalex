import type { ProcessedArgument } from '../arguments';

import { FormulaArray, FormulaString, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('["a", "b", "c"]'),
    result: () => new FormulaString('abc'),
  },
  {
    formula: (name) => name('["a", "b", "c"]', '", "'),
    result: () => new FormulaString('a, b, c'),
  },
  {
    formula: (name) => name('["a", "b", "c"]', '""'),
    result: () => new FormulaString('abc'),
  },
]);

routinesRegistry.registerFunction('join', {
  description: 'Returns the values of the list joined with the joiner.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument(Kind.Array, { name: 'list' }),
    new Argument(Kind.String, { name: 'separator', optional: true }),
  ]),
  handler: ({ node, visitor }) => {
    const [listArg, separatorArg] = visitor.evaluateNodes<[FormulaArray, FormulaString?]>(node.args);
    const separator = separatorArg?.value ?? '';
    const stringValues = listArg.value.map((item) => item.toString());
    return new FormulaString(stringValues.join(separator));
  },
});

routinesRegistry.registerMethod(FormulaArray, 'join', {
  description: 'Returns the values of the list joined with the joiner.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument(Kind.Array, { name: 'self' }),
    new Argument(Kind.String, { name: 'separator', optional: true }),
  ]),
  handler: ({ instance, args }) => {
    const [separatorArg] = args as [ProcessedArgument<FormulaString>?];

    // separatorArg can be FormulaDataType or undefined (if the argument is optional)
    const separator = separatorArg?.dataType.value ?? '';

    const stringValues = instance.value.map((item) => item.toString());

    return new FormulaString(stringValues.join(separator));
  },
});
