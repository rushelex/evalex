import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber, Kind } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]', 'current > 1'),
    result: () => new FormulaNumber(2),
  },
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaNumber(3),
  },
];

routinesRegistry.registerRoutine('count', {
  description: 'Returns the number of items for which the condition is true.',
  examples: routineExamples,
  arguments: [
    arg.array('list'),
    arg.eachItem('predicate', { returns: Kind.Boolean, optional: true }),
  ],
  returns: type.number,
  handler: ({ subject, args: [predicate] }) => new FormulaNumber(predicate === undefined
    ? subject.value.length
    : subject.value.filter((current, index) => predicate.execute({ current, index: new FormulaNumber(index) }).value).length),
});
