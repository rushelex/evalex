import { FormulaNumber, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('10'),
    result: () => new FormulaNumber(1),
  },
  {
    formula: (name) => name('100000'),
    result: () => new FormulaNumber(5),
  },
]);

routinesRegistry.registerRoutine('log10', {
  on: [FormulaNumber],
  description: 'Returns the base 10 logarithm of the number.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument(Kind.Number, {
      name: 'number',
      validation: (value) => {
        if (value.value <= 0) {
          return {
            message: 'Expected positive number.',
            actual: value.value,
            expected: ['positive number'],
            argumentPosition: 0,
          };
        }
      },
    }),
  ]),
  handler: ({ subject }) => new FormulaNumber(Math.log10(subject.value)),
});
