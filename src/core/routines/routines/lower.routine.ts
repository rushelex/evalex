import { FormulaString } from '../../data-types';
import { createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaString, 'lower', {
  description: 'Converts the string to lowercase.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"HELLO"'),
      result: () => new FormulaString('hello'),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaString(instance.value.toLowerCase());
  },
});
