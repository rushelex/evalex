import { FormulaString } from '../../data-types';
import { createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerMethod(FormulaString, 'trim', {
  description: 'Returns the string with leading and trailing whitespace removed.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"  hello  "'),
      result: () => new FormulaString('hello'),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaString(instance.value.trim());
  },
});
