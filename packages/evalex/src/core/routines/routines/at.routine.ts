import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNull, FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { expectInteger } from './expect-integer';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]', '1'),
    result: () => new FormulaNumber(2),
  },
  {
    formula: (name) => name('[1, 2, 3]', '-1'),
    result: () => new FormulaNumber(3),
  },
  {
    formula: (name) => name('[1, 2, 3]', '5'),
    result: () => FormulaNull.instance(),
  },
];

const T = type.variable('T');

routinesRegistry.registerRoutine('at', {
  description: 'Returns the item at the index, counted from the end if negative.',
  examples: routineExamples,
  arguments: [arg('list', type.array(T)), arg.number('index', { validation: expectInteger })],
  returns: type.union(T, type.null),
  handler: ({ subject, args: [index] }) => subject.value.at(index.value) ?? FormulaNull.instance(),
});
