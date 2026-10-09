import { FormulaString, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('trim', {
  on: [FormulaString],
  description: 'Returns the string with leading and trailing whitespace removed.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"  hello  "'),
      result: () => new FormulaString('hello'),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument(Kind.String, { name: 'text' }),
  ]),
  handler: ({ subject }) => {
    return new FormulaString(subject.value.trim());
  },
});
