import { FormulaNumber } from '../../data-types';
import { createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerFunction('pi', {
  description: 'Returns the ratio of a circle’s circumference to its diameter.',
  examples: createRoutineExamples([
    {
      formula: (name) => name(),
      result: () => new FormulaNumber(Math.PI),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: () => {
    return new FormulaNumber(Math.PI);
  },
});
