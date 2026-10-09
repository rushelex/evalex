import type { ProcessedArgument } from '../arguments';

import { evaluate, loc } from '../../../testing-library';
import { FormulaArray, FormulaNumber, FormulaString, Kind } from '../../data-types';
import { Errors } from '../../errors';
import { Argument, createRoutineArguments } from '../arguments';
import { RoutinesRegistry, routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('measure', {
  on: [FormulaString, FormulaArray],
  description: 'Returns the size of the text or list.',
  examples: createRoutineExamples([]),
  arguments: createRoutineArguments([
    [new Argument(Kind.String, { name: 'text' })],
    [new Argument(Kind.Array, { name: 'list' }), new Argument(Kind.Number, { name: 'extra', optional: true })],
  ]),
  handler: ({ subject, args }) => {
    const [extraArg] = args as [ProcessedArgument<FormulaNumber>?];
    return new FormulaNumber(subject.value.length + (extraArg?.dataType.value ?? 0));
  },
});

routinesRegistry.registerRoutine({ function: 'textShout', method: 'shout' }, {
  on: [FormulaString],
  description: 'Returns the text in upper case.',
  examples: createRoutineExamples([]),
  arguments: createRoutineArguments([
    new Argument(Kind.String, { name: 'text' }),
  ]),
  handler: ({ subject }) => new FormulaString(subject.value.toUpperCase()),
});

routinesRegistry.registerRoutine('total', {
  on: [FormulaNumber],
  description: 'Returns the sum of the numbers.',
  examples: createRoutineExamples([]),
  arguments: createRoutineArguments([
    new Argument(Kind.Number, { name: 'numbers', repeatable: true }),
  ]),
  handler: ({ subject, args }) => {
    const rest = (args as ProcessedArgument<FormulaNumber>[]).map((arg) => arg.dataType.value);

    return new FormulaNumber(rest.reduce((sum, value) => sum + value, subject.value));
  },
});

describe('RoutinesRegistry.registerRoutine', () => {
  it.each([
    { formula: 'measure("abc")', expected: 3 },
    { formula: '"abc".measure()', expected: 3 },
    { formula: 'measure([1, 2], 10)', expected: 12 },
    { formula: '[1, 2].measure(10)', expected: 12 },
  ])('should run one handler for both forms: $formula', ({ formula, expected }) => {
    expect(evaluate(formula)).toBeFormulaDataType(FormulaNumber, expected);
  });

  it('should give a method only the signatures whose subject accepts its type', () => {
    expect(() => evaluate('"abc".measure(10)')).toThrow(Errors.Argument.ExactCount.create(
      { expected: 0, actual: 1 },
      { location: loc(6, 13) },
    ));
  });

  it('should report a wrong subject in the function form as the first argument', () => {
    expect(() => evaluate('textShout(1)')).toThrow(Errors.Argument.TypeMismatch.create(
      { expected: [Kind.String], actual: Kind.Number, argumentPosition: 1 },
      { location: loc(10, 11) },
    ));
  });

  it('should register the function and the method under their own names', () => {
    expect(evaluate('textShout("hi")')).toBeFormulaDataType(FormulaString, 'HI');
    expect(evaluate('"hi".shout()')).toBeFormulaDataType(FormulaString, 'HI');
    expect(() => evaluate('shout("hi")')).toThrow(Errors.Reference.FunctionNotDefined.create({ name: 'shout' }, { location: loc(0, 11) }));
    expect(() => evaluate('"hi".textShout()')).toThrow(Errors.Reference.MethodNotDefined.create({ name: 'textShout', target: 'Text' }, { location: loc(5, 14) }));
  });

  it.each([
    { formula: 'total(1, 2, 3)', expected: 6 },
    { formula: '(1).total(2, 3)', expected: 6 },
    { formula: '(1).total()', expected: 1 },
  ])('should pass a repeatable subject first and the rest as arguments: $formula', ({ formula, expected }) => {
    expect(evaluate(formula)).toBeFormulaDataType(FormulaNumber, expected);
  });

  it('should reject a second registration under the same name', () => {
    const registry = new RoutinesRegistry();
    const options = {
      on: [FormulaString],
      description: 'Returns the text.',
      examples: createRoutineExamples([]),
      arguments: createRoutineArguments([new Argument(Kind.String, { name: 'text' })]),
      handler: ({ subject }: { subject: FormulaString }) => subject,
    };

    registry.registerRoutine('echo', options);

    expect(() => registry.registerRoutine('echo', options)).toThrow('Routine "echo" is already registered.');
  });

  it('should reject a type that no signature accepts as the subject', () => {
    const registry = new RoutinesRegistry();

    expect(() => registry.registerRoutine('echo', {
      on: [FormulaNumber],
      description: 'Returns the text.',
      examples: createRoutineExamples([]),
      arguments: createRoutineArguments([new Argument(Kind.String, { name: 'text' })]),
      handler: ({ subject }) => subject,
    })).toThrow('Routine "echo" has no signature whose first argument accepts Number.');
  });
});
