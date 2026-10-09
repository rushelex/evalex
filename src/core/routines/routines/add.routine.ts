import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber, FormulaString } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('5', '10'),
    result: () => new FormulaNumber(15),
  },
  {
    formula: (name) => name('"add"', '"text"'),
    result: () => new FormulaString('addtext'),
  },
];

routinesRegistry.registerRoutine('add', {
  description: 'Returns the sum of two numbers or joins two texts.',
  examples: routineExamples,
  arguments: [
    [arg.number('a'), arg.number('b')],
    [arg.string('a'), arg.string('b')],
  ],
  handler: ({ subject, args: [b] }) => (
    subject instanceof FormulaNumber && b instanceof FormulaNumber
      ? FormulaNumber.from(subject.value + b.value)
      : new FormulaString(`${subject.value}${b.value}`)
  ),
});
