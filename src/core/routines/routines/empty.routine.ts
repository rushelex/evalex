import { FormulaBoolean, Kind } from '../../data-types';
import { ALL_DATA_TYPES } from '../all-data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('1234'),
    result: () => new FormulaBoolean(false),
  },
  {
    formula: (name) => name('0'),
    result: () => new FormulaBoolean(true),
  },
  {
    formula: (name) => name('[]'),
    result: () => new FormulaBoolean(true),
  },
]);

const routineArguments = createRoutineArguments([
  new Argument(Kind.Any, { name: 'value' }),
]);

routinesRegistry.registerRoutine('empty', {
  on: ALL_DATA_TYPES,
  description: 'Returns true if the value is empty: 0, "", false or [].',
  examples: routineExamples,
  arguments: routineArguments,
  handler: ({ subject }) => new FormulaBoolean(subject.isEmpty()),
});
