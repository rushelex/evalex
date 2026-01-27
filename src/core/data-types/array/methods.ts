import type { CallbackExecutor, ProcessedArgument } from '../../routines/arguments';
import type { ToFormulaDataType } from '../types';

import { Argument, CallbackArgument, createRoutineArguments } from '../../routines/arguments';
import { routinesRegistry } from '../../routines/registry';
import { createRoutineExamples } from '../../routines/routine-examples';
import { convertValueToFormulaType } from '../converter';
import { defineCoreMethods } from '../core-methods';
import { FormulaNumber } from '../number';
import { FormulaString } from '../string';
import { FormulaArray } from './FormulaArray';

defineCoreMethods(FormulaArray);

FormulaArray.convert = function <T>(items: T[]): ToFormulaDataType<T>[] {
  return items.map((item) => {
    return convertValueToFormulaType(item);
  }) as ToFormulaDataType<T>[];
};

routinesRegistry.registerMethod(FormulaArray, 'map', {
  description: 'Returns the list populated with the results of calling the expression on every item in the input list.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('[1, 2, 3]', 'current * 2'),
      result: () => new FormulaArray([new FormulaNumber(2), new FormulaNumber(4), new FormulaNumber(6)]),
    },
    {
      formula: (name) => name('[1, 2, 3]', 'current + index'),
      result: () => new FormulaArray([new FormulaNumber(1), new FormulaNumber(3), new FormulaNumber(5)]),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument('array', { name: 'self' }),
    new CallbackArgument(['current', 'index'], {
      name: 'mapper',
      returnType: 'any',
    }),
  ]),
  handler: ({ instance, args }) => {
    const [callbackArg] = args as [CallbackExecutor];

    const results = instance.value.map((current, index) => {
      return callbackArg.execute({
        current,
        index: new FormulaNumber(index),
      });
    });

    return new FormulaArray(results);
  },
});

routinesRegistry.registerMethod(FormulaArray, 'filter', {
  description: 'Filters the list elements based on a predicate function. The callback receives `current` and `index` and must return a boolean.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('[1, 2, 3, 4, 5]', 'current > 3'),
      result: () => new FormulaArray([new FormulaNumber(4), new FormulaNumber(5)]),
    },
    {
      formula: (name) => name('[1, 2, 3, 4, 5]', 'index % 2 == 0'),
      result: () => new FormulaArray([new FormulaNumber(1), new FormulaNumber(3), new FormulaNumber(5)]),
    },
    {
      formula: (name) => name('["a", "b", "c"]', 'current == "a"'),
      result: () => new FormulaArray([new FormulaString('a')]),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument('array', { name: 'self' }),
    new CallbackArgument(['current', 'index'], {
      name: 'predicate',
      returnType: 'boolean',
    }),
  ]),
  handler: ({ instance, args }) => {
    const [predicate] = args as [CallbackExecutor];

    const results = instance.value.filter((current, index) => {
      const result = predicate.execute({
        current,
        index: new FormulaNumber(index),
      });

      return !!result.value;
    });

    return new FormulaArray(results);
  },
});

routinesRegistry.registerMethod(FormulaArray, 'join', {
  description: 'Returns the values of the list with the joiner placed between each of the values.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('["a", "b", "c"]'),
      result: () => new FormulaString('abc'),
    },
    {
      formula: (name) => name('["a", "b", "c"]', '", "'),
      result: () => new FormulaString('a, b, c'),
    },
    {
      formula: (name) => name('["a", "b", "c"]', '""'),
      result: () => new FormulaString('abc'),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument('array', { name: 'self' }),
    new Argument('string', { name: 'separator', optional: true }),
  ]),
  handler: ({ instance, args }) => {
    const [separatorArg] = args as [ProcessedArgument<FormulaString>?];

    // separatorArg can be FormulaDataType or undefined (if the argument is optional)
    const separator = separatorArg?.dataType.value ?? '';

    const stringValues = instance.value.map((item) => item.toString());

    return new FormulaString(stringValues.join(separator));
  },
});

routinesRegistry.registerMethod(FormulaArray, 'length', {
  description: 'Returns the length of the list.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('[1, 2, 3]'),
      result: () => new FormulaNumber(3),
    },
    {
      formula: (name) => name('[]'),
      result: () => new FormulaNumber(0),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaNumber(instance.value.length);
  },
});
