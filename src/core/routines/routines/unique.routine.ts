import type { FormulaDataType } from '../../data-types';
import type { RoutineExampleOptions } from '../routine-example';

import { areEqual, FormulaArray } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('[1, 1, 2]'),
    result: () => FormulaArray.from([1, 2]),
  },
  {
    formula: (name) => name('[[1], "1", [1]]'),
    result: () => FormulaArray.from([[1], '1']),
  },
];

routinesRegistry.registerRoutine('unique', {
  description: 'Returns the list without repeats, keeping the first of each.',
  examples: routineExamples,
  arguments: [arg.array('list')],
  returns: type.array(type.any),
  handler: ({ subject }) => {
    const kept: FormulaDataType[] = [];

    for (const item of subject.value) {
      if (!kept.some((earlier) => areEqual(earlier, item))) {
        kept.push(item);
      }
    }

    return new FormulaArray(kept);
  },
});
