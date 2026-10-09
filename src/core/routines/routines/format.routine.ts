import { ALL_DATA_TYPES, FormulaString, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('1234'),
    result: () => new FormulaString('1234'),
  },
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaString('1, 2, 3'),
  },
]);

const routineArguments = createRoutineArguments([
  new Argument(Kind.Any, { name: 'value' }),
]);

routinesRegistry.registerRoutine('format', {
  on: ALL_DATA_TYPES,
  description: 'Returns the value formatted as text.',
  examples: routineExamples,
  arguments: routineArguments,
  handler: ({ subject }) => new FormulaString(subject.toString()),
});
