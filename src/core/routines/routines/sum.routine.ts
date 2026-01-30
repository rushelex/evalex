import { FormulaArray, FormulaNumber, Kind } from '../../data-types';
import { ArgumentFormulaError } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

const routineExamples = createRoutineExamples([
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaNumber(6),
  },
  {
    formula: (name) => name('1', '2', '3'),
    result: () => new FormulaNumber(6),
  },
  {
    formula: (name) => name('1', '[2, 3, [4, 5]]'),
    result: () => new FormulaNumber(15),
  },
]);

routinesRegistry.registerFunction('sum', {
  description: 'Returns the sum of its arguments.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument([Kind.Array, Kind.Number], { name: 'numbers', repeatable: true }),
  ]),
  handler: ({ node, visitor, utils }) => {
    const flattenLiteralArgs = utils.flatArgs(node.args);

    const numbers = flattenLiteralArgs
      .flatMap((arg) => {
        const evaluated = visitor.evaluateNode(arg);
        return evaluated instanceof FormulaArray ? evaluated.value : evaluated;
      }) as FormulaNumber[];

    const result = numbers.reduce((acc, num) => acc + num.value, 0);

    return new FormulaNumber(result);
  },
});

routinesRegistry.registerMethod(FormulaArray, 'sum', {
  description: 'Returns the sum of its arguments.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument([Kind.Array, Kind.Number], { name: 'numbers', repeatable: true, optional: true }),
  ]),
  handler: ({ instance, args, visitor, location, utils }) => {
    const flattenInstanceValues = FormulaArray.flatValues(instance);

    if (flattenInstanceValues.some((num) => typeof num.value !== 'number')) {
      throw new ArgumentFormulaError(
        'All numbers must be numbers',
        {
          context: {
            actual: flattenInstanceValues.map((num) => typeof num.value),
            expected: 'numbers',
          },
          location,
        },
      );
    }

    const flattenInstanceNumberValues = flattenInstanceValues as FormulaNumber[];

    if (flattenInstanceNumberValues.some((num) => !Number.isFinite(num.value))) {
      throw new ArgumentFormulaError(
        'All numbers must be finite',
        {
          context: {
            actual: flattenInstanceNumberValues.map((num) => num.value),
            expected: 'finite numbers',
          },
          location,
        },
      );
    }

    const numbers = visitor.evaluateNodes<FormulaNumber[]>(utils.flatArgs(args));

    function sum(acc: number, num: FormulaNumber): number {
      return acc + num.value;
    }

    const result = numbers.reduce(sum, flattenInstanceNumberValues.reduce(sum, 0));

    return new FormulaNumber(result);
  },
});

routinesRegistry.registerMethod(FormulaNumber, 'sum', {
  description: 'Returns the sum of its arguments.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    new Argument([Kind.Array, Kind.Number], { name: 'numbers', repeatable: true, optional: true }),
  ]),
  handler: ({ instance, args, visitor, utils }) => {
    const flattenLiteralArgs = utils.flatArgs(args);

    const numbers = flattenLiteralArgs
      .flatMap((arg) => {
        const evaluated = visitor.evaluateNode(arg);
        return evaluated instanceof FormulaArray ? evaluated.value : evaluated;
      }) as FormulaNumber[];

    const result = numbers.reduce((acc, num) => acc + num.value, instance.value);

    return new FormulaNumber(result);
  },
});
