import { FormulaString } from '../../data-types';
import { createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaString, 'upper', {
  description: 'Converts the string to uppercase.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"hello"'),
      result: () => new FormulaString('HELLO'),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaString(instance.value.toLocaleUpperCase());
  },
});
