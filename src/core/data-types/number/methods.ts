import { Errors } from '../../errors';
import { routinesRegistry } from '../../routines/registry';
import { createRoutineExamples } from '../../routines/routine-examples';
import { defineCoreMethods } from '../core-methods';
import { FormulaNumber } from './FormulaNumber';

defineCoreMethods(FormulaNumber);

routinesRegistry.registerMethod(FormulaNumber, 'log2', {
  description: 'Returns the base 2 logarithm of the number.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('4'),
      result: () => new FormulaNumber(2),
    },
    {
      formula: (name) => name('1024'),
      result: () => new FormulaNumber(10),
    },
  ]),
  handler: ({ instance, location }) => {
    const number = instance.value;

    if (number <= 0) {
      throw Errors.Validation.PositiveNumberExpected.create({
        value: number,
      }, {
        location,
      });
    }

    return new FormulaNumber(Math.log2(number));
  },
});

routinesRegistry.registerMethod(FormulaNumber, 'log10', {
  description: 'Returns the base 10 logarithm of the number.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('10'),
      result: () => new FormulaNumber(1),
    },
    {
      formula: (name) => name('100000'),
      result: () => new FormulaNumber(5),
    },
  ]),
  handler: ({ instance, location }) => {
    const number = instance.value;

    if (number <= 0) {
      throw Errors.Validation.PositiveNumberExpected.create({
        value: number,
      }, {
        location,
      });
    }

    return new FormulaNumber(Math.log10(number));
  },
});
