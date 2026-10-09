import { FormulaString, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('upper', {
  on: [FormulaString],
  description: 'Converts the string to uppercase.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"hello"'),
      result: () => new FormulaString('HELLO'),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument(Kind.String, { name: 'text' }),
  ]),
  handler: ({ subject }) => {
    return new FormulaString(subject.value.toUpperCase());
  },
});
