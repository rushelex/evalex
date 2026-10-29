import { FormulaDate, FormulaNumber, Kind } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { RoutinesRegistry } from '../registry';
import { routineCatalog } from '../routine-catalog';

const zero = () => new FormulaNumber(0);

const NUMBER = { kind: 'Number' };

describe(routineCatalog, () => {
  it('should list a function with its arguments named, typed, optional and repeatable', () => {
    const registry = new RoutinesRegistry();

    registry.registerFunction('roundTo', {
      description: 'Rounds the number.',
      examples: [],
      arguments: [arg.number('number'), arg.oneOf('places', [Kind.Number, Kind.String], { optional: true })],
      returns: type.number,
      handler: zero,
    });
    registry.registerFunction('total', { description: 'Adds the numbers.', examples: [], arguments: [arg.number('numbers', { repeatable: true })], returns: type.number, handler: zero });

    expect(routineCatalog(registry)).toEqual([
      {
        name: 'roundTo',
        form: 'function',
        description: 'Rounds the number.',
        kinds: [],
        signatures: [{
          kinds: [],
          parameters: [
            { name: 'number', kinds: ['Number'], optional: false, repeatable: false },
            { name: 'places', kinds: ['Number', 'String'], optional: true, repeatable: false },
          ],
          returns: NUMBER,
        }],
      },
      {
        name: 'total',
        form: 'function',
        description: 'Adds the numbers.',
        kinds: [],
        signatures: [{ kinds: [], parameters: [{ name: 'numbers', kinds: ['Number'], optional: false, repeatable: true }], returns: NUMBER }],
      },
    ]);
  });

  it('should list a routine of both forms as a function with its subject and as a method without it', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('measure', {
      description: 'Returns the size of the text.',
      examples: [],
      arguments: [arg.string('text'), arg.number('extra', { optional: true })],
      returns: type.number,
      handler: zero,
    });

    expect(routineCatalog(registry)).toEqual([
      {
        name: 'measure',
        form: 'function',
        description: 'Returns the size of the text.',
        kinds: [],
        signatures: [{
          kinds: [],
          parameters: [
            { name: 'text', kinds: ['String'], optional: false, repeatable: false },
            { name: 'extra', kinds: ['Number'], optional: true, repeatable: false },
          ],
          returns: NUMBER,
        }],
      },
      {
        name: 'measure',
        form: 'method',
        description: 'Returns the size of the text.',
        kinds: ['String'],
        signatures: [{ kinds: ['String'], parameters: [{ name: 'extra', kinds: ['Number'], optional: true, repeatable: false }], returns: NUMBER }],
      },
    ]);
  });

  it('should give each argument list of a method the kinds it is accepted on', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('measure', {
      description: 'Returns the size of the text or list.',
      examples: [],
      arguments: [[arg.string('text')], [arg.array('list'), arg.number('extra', { optional: true })]],
      returns: [type.number, type.number],
      handler: zero,
    });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')).toEqual({
      name: 'measure',
      form: 'method',
      description: 'Returns the size of the text or list.',
      kinds: ['Array', 'String'],
      signatures: [
        { kinds: ['Array'], parameters: [{ name: 'extra', kinds: ['Number'], optional: true, repeatable: false }], returns: NUMBER },
        { kinds: ['String'], parameters: [], returns: NUMBER },
      ],
    });
  });

  it('should list an argument list several kinds accept once with all of them', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('pad', {
      description: 'Pads the value to the width.',
      examples: [],
      arguments: [arg.oneOf('value', [Kind.Number, Kind.String]), arg.number('width')],
      returns: type.number,
      handler: zero,
    });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')?.signatures).toEqual([
      { kinds: ['Number', 'String'], parameters: [{ name: 'width', kinds: ['Number'], optional: false, repeatable: false }], returns: NUMBER },
    ]);
  });

  it('should give each argument list the type of its result, and keep apart equal lists with different results', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('same', {
      description: 'Returns the value unchanged.',
      examples: [],
      arguments: [[arg.string('text')], [arg.number('number')]],
      returns: [type.string, type.number],
      handler: ({ subject }) => subject,
    });

    expect(routineCatalog(registry).map(({ form, signatures }) => [form, signatures.map(({ kinds, returns }) => [kinds, returns])])).toEqual([
      ['function', [[[], { kind: 'String' }], [[], NUMBER]]],
      ['method', [[['Number'], NUMBER], [['String'], { kind: 'String' }]]],
    ]);
  });

  it('should list a method name that means different things on different kinds once for each meaning', () => {
    const registry = new RoutinesRegistry();

    registry.registerMethod(FormulaNumber, 'plus', { description: 'Returns the sum of two numbers.', examples: [], arguments: [arg.number('b')], returns: type.number, handler: zero });
    registry.registerMethod(FormulaDate, 'plus', { description: 'Adds a duration to the date.', examples: [], arguments: [arg.duration('duration')], returns: type.number, handler: zero });

    expect(routineCatalog(registry)).toEqual([
      {
        name: 'plus',
        form: 'method',
        description: 'Adds a duration to the date.',
        kinds: ['Date'],
        signatures: [{ kinds: ['Date'], parameters: [{ name: 'duration', kinds: ['Duration'], optional: false, repeatable: false }], returns: NUMBER }],
      },
      {
        name: 'plus',
        form: 'method',
        description: 'Returns the sum of two numbers.',
        kinds: ['Number'],
        signatures: [{ kinds: ['Number'], parameters: [{ name: 'b', kinds: ['Number'], optional: false, repeatable: false }], returns: NUMBER }],
      },
    ]);
  });

  it('should list a method under each of its names, sorted by name with the function first', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine({ function: 'textWhisper', method: ['whisper', 'textWhisper'] }, {
      description: 'Returns the text in lower case.',
      examples: [],
      arguments: [arg.string('text')],
      returns: type.number,
      handler: zero,
    });

    expect(routineCatalog(registry).map(({ name, form }) => `${form} ${name}`)).toEqual(['function textWhisper', 'method textWhisper', 'method whisper']);
  });

  it('should give an argument evaluated once per item the kinds it returns and the variables it reads', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('keep', {
      description: 'Returns the items for which the condition is true.',
      examples: [],
      arguments: [arg.array('list'), arg.eachItem('condition', { returns: Kind.Boolean }), arg.callback('fallback', { variables: ['list'], optional: true })],
      returns: type.number,
      handler: zero,
    });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')?.signatures[0]?.parameters).toEqual([
      { name: 'condition', kinds: ['Boolean'], optional: false, repeatable: false, variables: ['current', 'index'] },
      { name: 'fallback', kinds: ['Any'], optional: true, repeatable: false, variables: ['list'] },
    ]);
  });

  it('should give a text argument that takes only some words those words', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('shift', {
      description: 'Shifts the date by the units.',
      examples: [],
      arguments: [arg.date('date'), arg.choice('unit', ['days', 'months'])],
      returns: type.number,
      handler: zero,
    });

    expect(routineCatalog(registry).map(({ signatures }) => signatures[0]?.parameters.at(-1))).toEqual([
      { name: 'unit', kinds: ['String'], optional: false, repeatable: false, choices: ['days', 'months'] },
      { name: 'unit', kinds: ['String'], optional: false, repeatable: false, choices: ['days', 'months'] },
    ]);
  });

  it('should give the words as a copy, so changing it does not change what a formula accepts', () => {
    const registry = new RoutinesRegistry();
    const units = ['days', 'months'];

    registry.registerFunction('pick', { description: 'Picks the unit.', examples: [], arguments: [arg.choice('unit', units)], returns: type.number, handler: zero });

    expect(routineCatalog(registry)[0]?.signatures[0]?.parameters[0]?.choices).not.toBe(units);
  });

  it('should keep the words of a repeatable subject the method form takes as further values', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('units', { description: 'Lists the units.', examples: [], arguments: [arg.choice('unit', ['days', 'months'], { repeatable: true })], returns: type.number, handler: zero });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')?.signatures[0]?.parameters).toEqual([
      { name: 'unit', kinds: ['String'], optional: true, repeatable: true, choices: ['days', 'months'] },
    ]);
  });

  it('should list a function that reads its call itself without signatures', () => {
    const registry = new RoutinesRegistry();

    registry.registerFunction('choose', { description: 'Returns one of the values.', examples: [], returns: type.number, handler: zero });

    expect(routineCatalog(registry)).toEqual([{ name: 'choose', form: 'function', description: 'Returns one of the values.', kinds: [], signatures: [] }]);
  });

  it('should list a method of any value with every kind', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('describe', { description: 'Describes the value.', examples: [], arguments: [arg.any('value')], returns: type.number, handler: zero });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')?.kinds).toEqual(['Array', 'Boolean', 'Date', 'DateTime', 'DateRange', 'Duration', 'Null', 'Number', 'Object', 'RegExp', 'String']);
  });
});
