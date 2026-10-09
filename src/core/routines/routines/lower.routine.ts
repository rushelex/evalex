import { FormulaString, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('lower', {
  on: [FormulaString],
  description: 'Converts the string to lowercase.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"HELLO"'),
      result: () => new FormulaString('hello'),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument(Kind.String, { name: 'text' }),
  ]),
  handler: ({ subject }) => {
    return new FormulaString(subject.value.toLowerCase());
  },
});
