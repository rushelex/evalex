import { FormulaNumber } from '../../data-types';
import { routinesRegistry } from '../registry';

routinesRegistry.registerFunction('e', {
  description: 'Returns the base of the natural logarithm.',
  examples: [
    {
      formula: (name) => name(),
      result: () => new FormulaNumber(Math.E),
    },
  ],
  arguments: [],
  handler: () => new FormulaNumber(Math.E),
});
