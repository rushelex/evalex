import type { CallbackExecutor, ProcessedArgument } from '../arguments';

import { FormulaArray, FormulaNumber, Kind } from '../../data-types';
import { Argument, CallbackArgument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('[1, 2, 3]', 'current * 2'),
    result: () => new FormulaArray([new FormulaNumber(2), new FormulaNumber(4), new FormulaNumber(6)]),
  },
  {
    formula: (name) => name('[1, 2, 3]', 'current + index'),
    result: () => new FormulaArray([new FormulaNumber(1), new FormulaNumber(3), new FormulaNumber(5)]),
  },
]);

routinesRegistry.registerFunction('map', {
  description: 'Returns the list populated with the results of calling the expression on every item in the input list.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument(Kind.Array, { name: 'list' }),
    new CallbackArgument(['current', 'index'], {
      name: 'mapper',
      returnType: Kind.Any,
    }),
  ]),
  handler: ({ args }) => {
    const [listArg, mapperArg] = args as [ProcessedArgument<FormulaArray>, CallbackExecutor];

    const results = listArg.dataType.value.map((item, index) => {
      return mapperArg.execute({
        current: item,
        index: new FormulaNumber(index),
      });
    });

    return new FormulaArray(results);
  },
});
