import { FormulaDate, FormulaNumber, Kind } from '../../data-types';
import { arg, Argument } from '../arguments';
import { RoutinesRegistry } from '../registry';
import { routineCatalog } from '../routine-catalog';

const zero = () => new FormulaNumber(0);

describe(routineCatalog, () => {
  it('should list a function with its arguments named, typed, optional and repeatable', () => {
    const registry = new RoutinesRegistry();

    registry.registerFunction('roundTo', {
      description: 'Rounds the number.',
      examples: [],
      arguments: [arg.number('number'), arg.oneOf('places', [Kind.Number, Kind.String], { optional: true })],
      handler: zero,
    });
    registry.registerFunction('total', { description: 'Adds the numbers.', examples: [], arguments: [arg.number('numbers', { repeatable: true })], handler: zero });

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
        }],
      },
      {
        name: 'total',
        form: 'function',
        description: 'Adds the numbers.',
        kinds: [],
        signatures: [{ kinds: [], parameters: [{ name: 'numbers', kinds: ['Number'], optional: false, repeatable: true }] }],
      },
    ]);
  });

  it('should list a routine of both forms as a function with its subject and as a method without it', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('measure', {
      description: 'Returns the size of the text.',
      examples: [],
      arguments: [arg.string('text'), arg.number('extra', { optional: true })],
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
        }],
      },
      {
        name: 'measure',
        form: 'method',
        description: 'Returns the size of the text.',
        kinds: ['String'],
        signatures: [{ kinds: ['String'], parameters: [{ name: 'extra', kinds: ['Number'], optional: true, repeatable: false }] }],
      },
    ]);
  });

  it('should give each argument list of a method the kinds it is accepted on', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('measure', {
      description: 'Returns the size of the text or list.',
      examples: [],
      arguments: [[arg.string('text')], [arg.array('list'), arg.number('extra', { optional: true })]],
      handler: zero,
    });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')).toEqual({
      name: 'measure',
      form: 'method',
      description: 'Returns the size of the text or list.',
      kinds: ['Array', 'String'],
      signatures: [
        { kinds: ['Array'], parameters: [{ name: 'extra', kinds: ['Number'], optional: true, repeatable: false }] },
        { kinds: ['String'], parameters: [] },
      ],
    });
  });

  it('should list an argument list several kinds accept once with all of them', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('pad', {
      description: 'Pads the value to the width.',
      examples: [],
      arguments: [arg.oneOf('value', [Kind.Number, Kind.String]), arg.number('width')],
      handler: zero,
    });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')?.signatures).toEqual([
      { kinds: ['Number', 'String'], parameters: [{ name: 'width', kinds: ['Number'], optional: false, repeatable: false }] },
    ]);
  });

  it('should list a method name that means different things on different kinds once for each meaning', () => {
    const registry = new RoutinesRegistry();

    registry.registerMethod(FormulaNumber, 'plus', { description: 'Returns the sum of two numbers.', examples: [], arguments: [arg.number('b')], handler: zero });
    registry.registerMethod(FormulaDate, 'plus', { description: 'Adds a duration to the date.', examples: [], arguments: [arg.duration('duration')], handler: zero });

    expect(routineCatalog(registry)).toEqual([
      {
        name: 'plus',
        form: 'method',
        description: 'Adds a duration to the date.',
        kinds: ['Date'],
        signatures: [{ kinds: ['Date'], parameters: [{ name: 'duration', kinds: ['Duration'], optional: false, repeatable: false }] }],
      },
      {
        name: 'plus',
        form: 'method',
        description: 'Returns the sum of two numbers.',
        kinds: ['Number'],
        signatures: [{ kinds: ['Number'], parameters: [{ name: 'b', kinds: ['Number'], optional: false, repeatable: false }] }],
      },
    ]);
  });

  it('should list a method under each of its names, sorted by name with the function first', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine({ function: 'textWhisper', method: ['whisper', 'textWhisper'] }, {
      description: 'Returns the text in lower case.',
      examples: [],
      arguments: [arg.string('text')],
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
      handler: zero,
    });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')?.signatures[0]?.parameters).toEqual([
      { name: 'condition', kinds: ['Boolean'], optional: false, repeatable: false, variables: ['current', 'index'] },
      { name: 'fallback', kinds: ['Any'], optional: true, repeatable: false, variables: ['list'] },
    ]);
  });

  it('should leave out the name of an argument the routine does not name', () => {
    const registry = new RoutinesRegistry();

    registry.registerFunction('identity', { description: 'Returns the number.', examples: [], arguments: [new Argument(Kind.Number)], handler: zero });

    expect(routineCatalog(registry)[0]?.signatures[0]?.parameters).toEqual([{ kinds: ['Number'], optional: false, repeatable: false }]);
  });

  it('should list a function that reads its call itself without signatures', () => {
    const registry = new RoutinesRegistry();

    registry.registerFunction('choose', { description: 'Returns one of the values.', examples: [], handler: zero });

    expect(routineCatalog(registry)).toEqual([{ name: 'choose', form: 'function', description: 'Returns one of the values.', kinds: [], signatures: [] }]);
  });

  it('should list a method of any value with every kind', () => {
    const registry = new RoutinesRegistry();

    registry.registerRoutine('describe', { description: 'Describes the value.', examples: [], arguments: [arg.any('value')], handler: zero });

    expect(routineCatalog(registry).find(({ form }) => form === 'method')?.kinds).toEqual(['Array', 'Boolean', 'Date', 'DateTime', 'DateRange', 'Duration', 'Null', 'Number', 'Object', 'RegExp', 'String']);
  });
});
