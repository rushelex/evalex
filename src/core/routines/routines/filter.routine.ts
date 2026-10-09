import type { CallbackExecutor } from '../arguments';

import { FormulaArray, FormulaNumber, FormulaString, Kind } from '../../data-types';
import { Argument, CallbackArgument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('[1, 2, 3, 4, 5]', 'current > 3'),
    result: () => new FormulaArray([new FormulaNumber(4), new FormulaNumber(5)]),
  },
  {
    formula: (name) => name('[1, 2, 3, 4, 5]', 'index % 2 == 0'),
    result: () => new FormulaArray([new FormulaNumber(1), new FormulaNumber(3), new FormulaNumber(5)]),
  },
  {
    formula: (name) => name('["a", "b", "c"]', 'current == "a"'),
    result: () => new FormulaArray([new FormulaString('a')]),
  },
]);

routinesRegistry.registerRoutine('filter', {
  on: [FormulaArray],
  description: 'Returns the values in the list for which the condition is true.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument(Kind.Array, { name: 'list' }),
    new CallbackArgument(['current', 'index'], {
      name: 'predicate',
      returnType: Kind.Boolean,
    }),
  ]),
  handler: ({ subject, args }) => {
    const [predicateArg] = args as [CallbackExecutor];

    const results = subject.value.filter((current, index) => {
      const result = predicateArg.execute({
        current,
        index: new FormulaNumber(index),
      });

      return !!result.value;
    });

    return new FormulaArray(results);
  },
});
