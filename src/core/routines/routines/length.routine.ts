import type { FormulaArray, FormulaString } from '../../data-types';

import { FormulaNumber, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('"hello"'),
    result: () => new FormulaNumber(5),
  },
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaNumber(3),
  },
]);

routinesRegistry.registerFunction('length', {
  description: 'Returns the length of the text or list.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    [new Argument(Kind.String, { name: 'text' })],
    [new Argument(Kind.Array, { name: 'list' })],
  ]),
  handler: ({ node, visitor }) => {
    const [textArg] = visitor.evaluateNodes<[FormulaString | FormulaArray]>(node.args);
    return new FormulaNumber(textArg.value.length);
  },
});
