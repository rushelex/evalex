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

routinesRegistry.registerRoutine('join', {
  on: [FormulaArray],
  description: 'Returns the values of the list joined with the joiner.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument(Kind.Array, { name: 'list' }),
    new Argument(Kind.String, { name: 'separator', optional: true }),
  ]),
  handler: ({ subject, args }) => {
    const [separatorArg] = args as [ProcessedArgument<FormulaString>?];
    const separator = separatorArg?.dataType.value ?? '';
    const stringValues = subject.value.map((item) => item.toString());

    return new FormulaString(stringValues.join(separator));
  },
});
