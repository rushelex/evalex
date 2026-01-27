import { FormulaNumber } from '../../data-types';
import { createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerFunction('e', {
  description: 'Returns the base of the natural logarithm.',
  examples: createRoutineExamples([
    {
      formula: (name) => name(),
      result: () => new FormulaNumber(Math.E),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: () => {
    return new FormulaNumber(Math.E);
  },
});
