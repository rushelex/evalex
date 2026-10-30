import type { RoutineExampleOptions } from '../routine-example';

import { decimalArithmetic, FormulaNumber, FormulaString } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('5', '10'),
    result: () => new FormulaNumber(15),
  },
  {
    formula: (name) => name('0.1', '0.2'),
    result: () => new FormulaNumber(0.3),
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
  returns: [type.number, type.string],
  handler: ({ subject, args: [b] }) => (
    subject instanceof FormulaNumber && b instanceof FormulaNumber
      ? decimalArithmetic.add(subject, b)
      : new FormulaString(`${subject.value}${b.value}`)
  ),
});
