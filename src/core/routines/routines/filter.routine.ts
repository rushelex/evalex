import type { RoutineExampleOptions } from '../routine-example';

import { FormulaArray, FormulaNumber, FormulaString, Kind } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
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
];

routinesRegistry.registerRoutine('filter', {
  description: 'Returns the values in the list for which the condition is true.',
  examples: routineExamples,
  arguments: [
    arg.array('list'),
    arg.eachItem('predicate', { returns: Kind.Boolean }),
  ],
  handler: ({ subject, args: [predicate] }) => {
    const results = subject.value.filter((current, index) => predicate.execute({ current, index: new FormulaNumber(index) }).value);

    return new FormulaArray(results);
  },
});
