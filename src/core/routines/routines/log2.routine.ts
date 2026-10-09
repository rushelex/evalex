import { FormulaNumber, Kind } from '../../data-types';
import { Errors } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('4'),
    result: () => new FormulaNumber(2),
  },
  {
    formula: (name) => name('1024'),
    result: () => new FormulaNumber(10),
  },
]);

routinesRegistry.registerFunction('log2', {
  description: 'Returns the base 2 logarithm of the number.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument(Kind.Number, {
      name: 'number',
      validation: (value) => {
        if (value.value <= 0) {
          return {
            message: 'Expected positive number.',
            actual: value.value,
            expected: ['positive number'],
            argumentPosition: 0,
          };
        }
      },
    }),
  ]),
  handler: ({ node, visitor }) => {
    const [numberArg] = visitor.evaluateNodes<[FormulaNumber]>(node.args);
    const number = numberArg.value;
    return new FormulaNumber(Math.log2(number));
  },
});

routinesRegistry.registerMethod(FormulaNumber, 'log2', {
  description: 'Returns the base 2 logarithm of the number.',
  examples: routineExamples,
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
