import type { RoutineExampleOptions } from '../routine-example';

import { areEqual, FormulaBoolean } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 2, 3]', '2'),
    result: () => new FormulaBoolean(true),
  },
  {
    formula: (name) => name('[1, 2, 3]', '4'),
    result: () => new FormulaBoolean(false),
  },
  {
    formula: (name) => name('[[1, 2]]', '[1, 2]'),
    result: () => new FormulaBoolean(true),
  },
];

routinesRegistry.registerRoutine('includes', {
  description: 'Returns true if the list contains the value, and false otherwise.',
  examples: routineExamples,
  arguments: [arg.array('list'), arg.any('value')],
  returns: type.boolean,
  handler: ({ subject, args: [value] }) => new FormulaBoolean(subject.value.some((item) => areEqual(item, value))),
});
