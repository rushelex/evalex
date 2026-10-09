import type { CallbackExecutor, ProcessedArgument } from '../arguments';

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

routinesRegistry.registerFunction('filter', {
  description: 'Returns the values in the list for which the condition is true.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument(Kind.Array, { name: 'list' }),
    new CallbackArgument(['current', 'index'], {
      name: 'predicate',
      returnType: Kind.Boolean,
    }),
  ]),
  handler: ({ args }) => {
    const [listArg, predicateArg] = args as [ProcessedArgument<FormulaArray>, CallbackExecutor];

    const results = listArg.dataType.value.filter((item, index) => {
      const result = predicateArg.execute({
        current: item,
        index: new FormulaNumber(index),
      });

      return !!result.value;
    });

    return new FormulaArray(results);
  },
});

routinesRegistry.registerMethod(FormulaArray, 'filter', {
  description: 'Returns the values in the list for which the condition is true.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument(Kind.Array, { name: 'self' }),
    new CallbackArgument(['current', 'index'], {
      name: 'predicate',
      returnType: Kind.Boolean,
    }),
  ]),
  handler: ({ instance, args }) => {
    const [predicate] = args as [CallbackExecutor];

    const results = instance.value.filter((current, index) => {
      const result = predicate.execute({
        current,
        index: new FormulaNumber(index),
      });

      return !!result.value;
    });

    return new FormulaArray(results);
  },
});
