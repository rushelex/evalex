import { FormulaDate, FormulaNumber } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { RoutinesRegistry } from '../registry';
import { routineCatalog } from '../routine-catalog';

const zero = () => new FormulaNumber(0);

const NUMBER = { kind: 'Number' };
const STRING = { kind: 'String' };

describe(routineCatalog, () => {
  it('should list a function with its arguments named, typed, optional and repeatable', () => {
    const registry = new RoutinesRegistry();

    registry.registerFunction('roundTo', {
      description: 'Rounds the number.',
      examples: [],
      arguments: [arg.number('number'), arg('places', type.union(type.number, type.string), { optional: true })],
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
          parameters: [
            { name: 'number', type: NUMBER, optional: false, repeatable: false },
            { name: 'places', type: { kind: 'Union', of: [NUMBER, STRING] }, optional: true, repeatable: false },
          ],
          returns: NUMBER,
        }],
      },
      {
        name: 'total',
        form: 'function',
        description: 'Adds the numbers.',
        kinds: [],
        signatures: [{ parameters: [{ name: 'numbers', type: NUMBER, optional: false, repeatable: true }], returns: NUMBER }],
      },
    ]);
  });

  it('should give an argument the type of the values it takes, and the result the variables the arguments bind', () => {
    const registry = new RoutinesRegistry();
    const T = type.variable('T');

    registry.registerFunction('pick', {
      description: 'Returns an item of the list.',
      examples: [],
      arguments: [arg('list', type.array(T)), arg.number('index')],
      returns: type.union(T, type.null),
      handler: zero,
    });

    expect(routineCatalog(registry)[0]?.signatures).toEqual([{
      parameters: [
        { name: 'list', type: { kind: 'Array', items: { kind: 'Variable', name: 'T' } }, optional: false, repeatable: false },
        { name: 'index', type: NUMBER, optional: false, repeatable: false },
      ],
      returns: { kind: 'Union', of: [{ kind: 'Variable', name: 'T' }, { kind: 'Null' }] },
    }]);
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
          parameters: [
            { name: 'text', type: STRING, optional: false, repeatable: false },
            { name: 'extra', type: NUMBER, optional: true, repeatable: false },
          ],
          returns: NUMBER,
        }],
      },
      {
        name: 'measure',
        form: 'method',
        description: 'Returns the size of the text.',
        kinds: ['String'],
        signatures: [{ subject: STRING, parameters: [{ name: 'extra', type: NUMBER, optional: true, repeatable: false }], returns: NUMBER }],
      },
    ]);
  });

  it('should give each argument list of a method the type of the value it is called on', () => {
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
        { subject: { kind: 'Array', items: { kind: 'Any' } }, parameters: [{ name: 'extra', type: NUMBER, optional: true, repeatable: false }], returns: NUMBER },
        { subject: STRING, parameters: [], returns: NUMBER },
      ],
    });
  });

  it('should give a method the type of its value with the variables the result follows', () => {
    const registry = new RoutinesRegistry();
    const T = type.variable('T');

    registry.registerRoutine('head', {
      description: 'Returns the first item.',
      examples: [],
      arguments: [arg('list', type.array(T))],
      returns: type.union(T, type.null),
      handler: ({ subject }) => subject.value[0] ?? zero(),
    });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')?.signatures).toEqual([{
      subject: { kind: 'Array', items: { kind: 'Variable', name: 'T' } },
      parameters: [],
      returns: { kind: 'Union', of: [{ kind: 'Variable', name: 'T' }, { kind: 'Null' }] },
    }]);
  });

  it('should list an argument list several kinds accept once, called on any of them', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('pad', {
      description: 'Pads the value to the width.',
      examples: [],
      arguments: [arg('value', type.union(type.number, type.string)), arg.number('width')],
      returns: type.number,
      handler: zero,
    });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')?.signatures).toEqual([
      { subject: { kind: 'Union', of: [NUMBER, STRING] }, parameters: [{ name: 'width', type: NUMBER, optional: false, repeatable: false }], returns: NUMBER },
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

    expect(routineCatalog(registry).map(({ form, signatures }) => [form, signatures.map(({ subject, returns }) => [subject, returns])])).toEqual([
      ['function', [[undefined, STRING], [undefined, NUMBER]]],
      ['method', [[NUMBER, NUMBER], [STRING, STRING]]],
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
        signatures: [{ subject: { kind: 'Date' }, parameters: [{ name: 'duration', type: { kind: 'Duration' }, optional: false, repeatable: false }], returns: NUMBER }],
      },
      {
        name: 'plus',
        form: 'method',
        description: 'Returns the sum of two numbers.',
        kinds: ['Number'],
        signatures: [{ subject: NUMBER, parameters: [{ name: 'b', type: NUMBER, optional: false, repeatable: false }], returns: NUMBER }],
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

  it('should give an argument evaluated once per item the type it returns and the variables it reads', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('keep', {
      description: 'Returns the items for which the condition is true.',
      examples: [],
      arguments: [arg.array('list'), arg.eachItem('condition', { returns: type.boolean }), arg.callback('fallback', { variables: ['list'], optional: true })],
      returns: type.number,
      handler: zero,
    });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')?.signatures[0]?.parameters).toEqual([
      { name: 'condition', type: { kind: 'Boolean' }, optional: false, repeatable: false, variables: ['current', 'index'] },
      { name: 'fallback', type: { kind: 'Any' }, optional: true, repeatable: false, variables: ['list'] },
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
      { name: 'unit', type: STRING, optional: false, repeatable: false, choices: ['days', 'months'] },
      { name: 'unit', type: STRING, optional: false, repeatable: false, choices: ['days', 'months'] },
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
      { name: 'unit', type: STRING, optional: true, repeatable: true, choices: ['days', 'months'] },
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
