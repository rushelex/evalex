import type { RoutineExampleOptions } from '../routine-example';

import { FormulaString } from '../../data-types';
import { Errors } from '../../errors';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('"0"', '4'),
    result: () => new FormulaString('0000'),
  },
  {
    formula: (name) => name('"ab"', '0'),
    result: () => new FormulaString(''),
  },
];

routinesRegistry.registerRoutine('repeat', {
  description: 'Returns the text repeated the given number of times.',
  examples: routineExamples,
  arguments: [
    arg.string('text'),
    arg.number('times', {
      validation: (times) => (Number.isInteger(times.value) && times.value >= 0
        ? undefined
        : { message: 'Expected integer of 0 or more.', expected: ['integer of 0 or more'], actual: times.value }),
    }),
  ],
  returns: type.string,
  handler: ({ subject, args: [times], locations }) => {
    try {
      return new FormulaString(subject.value.repeat(times.value));
    }
    catch (error) {
      // JavaScript strings stop at about 2^29 characters
      throw Errors.Argument.Validation.create({
        message: 'Expected fewer times: the text would be too long.',
        expected: ['fewer times'],
        actual: times.value,
        argumentPosition: 2,
      }, { location: locations[0], cause: error instanceof Error ? error : undefined });
    }
  },
});
