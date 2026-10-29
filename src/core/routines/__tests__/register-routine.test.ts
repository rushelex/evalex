import { evaluate, loc } from '../../../testing-library';
import { FormulaNumber, FormulaString, Kind } from '../../data-types';
import { Errors } from '../../errors';
import { type } from '../../types';
import { arg } from '../arguments';
import { RoutinesRegistry, routinesRegistry } from '../registry';

routinesRegistry.registerRoutine('measure', {
  description: 'Returns the size of the text or list.',
  examples: [],
  arguments: [
    [arg.string('text')],
    [arg.array('list'), arg.number('extra', { optional: true })],
  ],
  returns: [type.number, type.number],
  handler: ({ subject, args: [extra] }) => new FormulaNumber(subject.value.length + (extra?.value ?? 0)),
});

routinesRegistry.registerRoutine({ function: 'textShout', method: 'shout' }, {
  description: 'Returns the text in upper case.',
  examples: [],
  arguments: [arg.string('text')],
  returns: type.string,
  handler: ({ subject }) => new FormulaString(subject.value.toUpperCase()),
});

routinesRegistry.registerRoutine({ function: 'textWhisper', method: ['whisper', 'textWhisper'] }, {
  description: 'Returns the text in lower case.',
  examples: [],
  arguments: [arg.string('text')],
  returns: type.string,
  handler: ({ subject }) => new FormulaString(subject.value.toLowerCase()),
});

routinesRegistry.registerRoutine('total', {
  description: 'Returns the sum of the numbers.',
  examples: [],
  arguments: [arg.number('numbers', { repeatable: true })],
  returns: type.number,
  handler: ({ subject, args }) => new FormulaNumber(args.reduce((sum, number) => sum + number.value, subject.value)),
});

routinesRegistry.registerRoutine('half', {
  description: 'Returns half of a positive number.',
  examples: [],
  arguments: [
    arg.number('number', {
      validation: (value) => (value.value > 0 ? undefined : { message: 'Expected positive number.' }),
    }),
  ],
  returns: type.number,
  handler: ({ subject }) => new FormulaNumber(subject.value / 2),
});

routinesRegistry.registerRoutine('shift', {
  description: 'Returns the number moved by a step in the given direction.',
  examples: [],
  arguments: [arg.number('number'), arg.choice('direction', ['up', 'down'])],
  returns: type.number,
  handler: ({ subject, args: [direction] }) => new FormulaNumber(direction.value === 'up' ? subject.value + 1 : subject.value - 1),
});

routinesRegistry.registerRoutine('ratio', {
  description: 'Returns the number divided by a non-zero divisor.',
  examples: [],
  arguments: [arg.number('number'), arg.number('divisor')],
  returns: type.number,
  handler: ({ subject, args: [divisor], locations }) => {
    if (divisor.value === 0) {
      throw Errors.Arithmetic.DivisionByZero.create({ dividend: subject.value }, { location: locations[0] });
    }

    return new FormulaNumber(subject.value / divisor.value);
  },
});

routinesRegistry.registerRoutine('pad', {
  description: 'Returns the text padded to a width.',
  examples: [],
  arguments: [
    [arg.string('text'), arg.number('width')],
    [arg.string('text'), arg.number('width'), arg.string('filler')],
  ],
  returns: [type.string, type.string],
  handler: ({ subject, args: [width, filler] }) => new FormulaString(subject.value.padEnd(width.value, filler?.value)),
});

describe('RoutinesRegistry.registerRoutine', () => {
  it.each([
    { formula: 'half(-2)', location: loc(5, 7), argumentPosition: 1 },
    { formula: '(-2).half()', location: loc(5, 9), argumentPosition: 0 },
  ])('should validate the subject in both forms: $formula', ({ formula, location, argumentPosition }) => {
    expect(() => evaluate(formula)).toThrow(Errors.Argument.Validation.create(
      { message: 'Expected positive number.', expected: ['valid value'], actual: '-2', argumentPosition },
      { location },
    ));
  });

  it.each([
    { formula: 'shift(1, "up")', expected: 2 },
    { formula: '(1).shift("down")', expected: 0 },
  ])('should accept a listed word for a choice: $formula', ({ formula, expected }) => {
    expect(evaluate(formula)).toBeFormulaDataType(FormulaNumber, expected);
  });

  it.each([
    { formula: 'shift(1, "left")', location: loc(9, 15), argumentPosition: 2 },
    { formula: '(1).shift("left")', location: loc(10, 16), argumentPosition: 1 },
  ])('should reject a word a choice does not list: $formula', ({ formula, location, argumentPosition }) => {
    expect(() => evaluate(formula)).toThrow(Errors.Argument.Validation.create(
      { message: 'Expected "up", "down".', expected: ['up', 'down'], actual: 'left', argumentPosition },
      { location },
    ));
  });

  it.each([
    { formula: 'ratio(6, 0)', location: loc(9, 10) },
    { formula: '(6).ratio(0)', location: loc(10, 11) },
  ])('should give the handler the location of each argument: $formula', ({ formula, location }) => {
    expect(() => evaluate(formula)).toThrow(Errors.Arithmetic.DivisionByZero.create({ dividend: 6 }, { location }));
  });

  it.each([
    { formula: 'pad("a", "b")', location: loc(9, 12), argumentPosition: 2 },
    { formula: '"a".pad("b")', location: loc(8, 11), argumentPosition: 1 },
  ])('should count the subject as a fitting argument when choosing which signature to report: $formula', ({ formula, location, argumentPosition }) => {
    expect(() => evaluate(formula)).toThrow(Errors.Argument.TypeMismatch.create(
      { expected: [Kind.Number], actual: Kind.String, argumentPosition },
      { location },
    ));
  });

  it('should give the method form only to the types the subject accepts', () => {
    expect(() => evaluate('(1).measure()')).toThrow(Errors.Reference.MethodNotDefined.create({ name: 'measure', target: 'Number' }, { location: loc(4, 11) }));
  });

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

  it('should report in the function form only the signatures whose subject accepts the first argument', () => {
    expect(() => evaluate('measure("abc", 10)')).toThrow(Errors.Argument.ExactCount.create(
      { expected: 1, actual: 2 },
      { location: loc(0, 18) },
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
    { formula: '"HI".whisper()' },
    { formula: '"HI".textWhisper()' },
    { formula: 'textWhisper("HI")' },
  ])('should register the method under each of its names: $formula', ({ formula }) => {
    expect(evaluate(formula)).toBeFormulaDataType(FormulaString, 'hi');
  });

  it.each([
    { functionName: 'textWhisper', methodName: 'whisper' },
    { functionName: 'textShout', methodName: 'shout' },
    { functionName: 'measure', methodName: 'measure' },
    { functionName: 'today', methodName: undefined },
  ])('should report $methodName as the method form of $functionName', ({ functionName, methodName }) => {
    expect(routinesRegistry.getMethodName(functionName)).toBe(methodName);
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
    const definition = {
      description: 'Returns the text.',
      examples: [],
      arguments: [arg.string('text')],
      returns: type.string,
      handler: ({ subject }: { subject: FormulaString }) => subject,
    } as const;

    registry.registerRoutine('echo', definition);

    expect(() => registry.registerRoutine('echo', definition)).toThrow('Routine "echo" is already registered.');
  });
});
