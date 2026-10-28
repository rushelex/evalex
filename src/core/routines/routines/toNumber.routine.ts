import type { RoutineExampleOptions } from '../routine-example';

import { FormulaBoolean, FormulaDateTime, FormulaNumber, FormulaString } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('"2"'),
    result: () => new FormulaNumber(2),
  },
  {
    formula: (name) => name('true'),
    result: () => new FormulaNumber(1),
  },
  {
    formula: (name) => name('parseDate("2023-07-10T21:35Z")'),
    result: () => new FormulaNumber(1689024900000),
  },
  {
    formula: (name) => name('2'),
    result: () => new FormulaNumber(2),
  },
];

routinesRegistry.registerRoutine('toNumber', {
  description: 'Returns the value as a number; a date gives its timestamp.',
  examples: routineExamples,
  arguments: [
    [arg.string('text', {
      validation: (text) => (Number.isNaN(readNumber(text.value))
        ? { message: 'Expected text that holds a number.', expected: ['text that holds a number'], actual: text.value }
        : undefined),
    })],
    [arg.number('number')],
    [arg.boolean('boolean')],
    [arg.dateTime('date')],
  ],
  handler: ({ subject }) => {
    if (subject instanceof FormulaString) {
      return new FormulaNumber(readNumber(subject.value));
    }

    if (subject instanceof FormulaBoolean) {
      return new FormulaNumber(subject.value ? 1 : 0);
    }

    if (subject instanceof FormulaDateTime) {
      return new FormulaNumber(subject.value.epochMilliseconds);
    }

    return subject;
  },
});

// Reads text as JavaScript's `Number` does, except that blank text holds no number instead of reading as 0
function readNumber(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text);
}
