import { FormulaNumber } from '../../data-types';
import { routinesRegistry } from '../registry';

routinesRegistry.registerFunction('pi', {
  description: 'Returns the ratio of a circle’s circumference to its diameter.',
  examples: [
    {
      formula: (name) => name(),
      result: () => new FormulaNumber(Math.PI),
    },
  ],
  arguments: [],
  handler: () => new FormulaNumber(Math.PI),
});
