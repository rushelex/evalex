import { FormulaNumber, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('4'),
    result: () => new FormulaNumber(2),
  },
  {
    formula: (name) => name('1024'),
    result: () => new FormulaNumber(10),
  },
]);

routinesRegistry.registerRoutine('log2', {
  on: [FormulaNumber],
  description: 'Returns the base 2 logarithm of the number.',
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
  handler: ({ subject }) => new FormulaNumber(Math.log2(subject.value)),
});
