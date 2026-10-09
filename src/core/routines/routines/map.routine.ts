import type { RoutineExampleOptions } from '../routine-example';

import { FormulaArray, FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]', 'current * 2'),
    result: () => new FormulaArray([new FormulaNumber(2), new FormulaNumber(4), new FormulaNumber(6)]),
  },
  {
    formula: (name) => name('[1, 2, 3]', 'current + index'),
    result: () => new FormulaArray([new FormulaNumber(1), new FormulaNumber(3), new FormulaNumber(5)]),
  },
];

routinesRegistry.registerRoutine('map', {
  description: 'Returns the list with the expression applied to every item.',
  examples: routineExamples,
  arguments: [
    arg.array('list'),
    arg.eachItem('mapper'),
  ],
  handler: ({ subject, args: [mapper] }) => {
    const results = subject.value.map((current, index) => mapper.execute({ current, index: new FormulaNumber(index) }));

    return new FormulaArray(results);
  },
});
