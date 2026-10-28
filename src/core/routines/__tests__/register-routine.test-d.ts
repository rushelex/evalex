import type { AST } from '../../../parser';
import type { FormulaArray, FormulaBoolean, FormulaDataType, FormulaDuration, FormulaRegExp, FormulaString } from '../../data-types';
import type { CallbackExecutor, ChoiceValue } from '../arguments';

import { FormulaDateTime, FormulaNumber, Kind } from '../../data-types';
import { arg } from '../arguments';
import { RoutinesRegistry } from '../registry';

const registry = new RoutinesRegistry();

describe('RoutinesRegistry.registerRoutine handler types', () => {
  it('should type the subject and the arguments from a single signature', () => {
    registry.registerRoutine('replace', {
      description: '',
      examples: [],
      arguments: [arg.string('text'), arg.pattern('pattern'), arg.string('replacement')],
      handler: ({ subject, args }) => {
        expectTypeOf(subject).toEqualTypeOf<FormulaString>();
        expectTypeOf(args).toEqualTypeOf<[FormulaString | FormulaRegExp, FormulaString]>();

        return subject;
      },
    });
  });

  it('should leave an optional argument possibly missing', () => {
    registry.registerRoutine('join', {
      description: '',
      examples: [],
      arguments: [arg.array('list'), arg.string('separator', { optional: true })],
      handler: ({ subject, args }) => {
        expectTypeOf(subject).toEqualTypeOf<FormulaArray>();
        expectTypeOf(args).toEqualTypeOf<[FormulaString?]>();

        return subject;
      },
    });
  });

  it('should spread a repeatable subject into the arguments', () => {
    registry.registerRoutine('sum', {
      description: '',
      examples: [],
      arguments: [arg.oneOf('numbers', [Kind.Array, Kind.Number], { repeatable: true })],
      handler: ({ subject, args }) => {
        expectTypeOf(subject).toEqualTypeOf<FormulaArray | FormulaNumber>();
        expectTypeOf(args).toEqualTypeOf<(FormulaArray | FormulaNumber)[]>();

        return subject;
      },
    });
  });

  it('should give one argument tuple per alternative signature', () => {
    registry.registerRoutine('dateAdd', {
      description: '',
      examples: [],
      arguments: [
        [arg.dateTime('date'), arg.duration('duration')],
        [arg.dateTime('date'), arg.number('amount'), arg.choice('unit', ['years', 'days'])],
      ],
      handler: ({ subject, args }) => {
        expectTypeOf(subject).toEqualTypeOf<FormulaDateTime>();
        expectTypeOf(args).toEqualTypeOf<[FormulaDuration] | [FormulaNumber, ChoiceValue<'years' | 'days'>]>();

        return subject;
      },
    });
  });

  it('should narrow a choice to the listed words', () => {
    registry.registerRoutine('between', {
      description: '',
      examples: [],
      arguments: [arg.dateTime('date'), arg.dateTime('other'), arg.choice('unit', ['years', 'days'])],
      handler: ({ subject, args: [, unit] }) => {
        expectTypeOf(unit.value).toEqualTypeOf<'years' | 'days'>();

        return subject;
      },
    });
  });

  it('should type a callback by its variables and return type', () => {
    registry.registerRoutine('filter', {
      description: '',
      examples: [],
      arguments: [arg.array('list'), arg.callback('predicate', { variables: ['current', 'index'], returns: Kind.Boolean })],
      handler: ({ subject, args: [predicate] }) => {
        expectTypeOf(predicate).toEqualTypeOf<CallbackExecutor<'current' | 'index', FormulaBoolean>>();
        expectTypeOf<Parameters<typeof predicate.execute>[0]>().toEqualTypeOf<Readonly<Record<'current' | 'index', FormulaDataType>>>();

        return subject;
      },
    });
  });

  it('should give a per-item callback exactly the current item and its index', () => {
    registry.registerRoutine('every', {
      description: '',
      examples: [],
      arguments: [arg.array('list'), arg.eachItem('predicate', { returns: Kind.Boolean })],
      handler: ({ subject, args: [predicate] }) => {
        expectTypeOf(predicate).toEqualTypeOf<CallbackExecutor<'current' | 'index', FormulaBoolean>>();

        return subject;
      },
    });
  });

  it('should reject a callback as the call subject', () => {
    registry.registerRoutine('broken', {
      description: '',
      examples: [],
      // @ts-expect-error The subject must be a value.
      arguments: [arg.callback('predicate', { variables: ['current'] })],
      handler: () => new FormulaNumber(0),
    });
  });

  it('should keep the declared type of a validated value', () => {
    arg.number('number', {
      validation: (value) => {
        expectTypeOf(value).toEqualTypeOf<FormulaNumber>();

        return undefined;
      },
    });
  });

  it('should keep the flags of an argument that also has a validation', () => {
    const argument = arg.number('number', { optional: true, validation: () => undefined });

    expectTypeOf(argument.optional).toEqualTypeOf<true>();
    expectTypeOf(argument.repeatable).toEqualTypeOf<false>();
  });
});

describe('RoutinesRegistry.registerFunction handler types', () => {
  it('should type the arguments from the signature', () => {
    registry.registerFunction('parse', {
      description: '',
      examples: [],
      arguments: [arg.string('text'), arg.number('base', { optional: true })],
      handler: ({ args }) => {
        expectTypeOf(args).toEqualTypeOf<[FormulaString, FormulaNumber?]>();

        return new FormulaNumber(0);
      },
    });
  });

  it('should give no arguments to a routine declared without any', () => {
    registry.registerFunction('zero', {
      description: '',
      examples: [],
      arguments: [],
      handler: ({ args }) => {
        expectTypeOf(args).toEqualTypeOf<[]>();

        return new FormulaNumber(0);
      },
    });
  });

  it('should leave the arguments to a routine that evaluates them itself', () => {
    registry.registerFunction('lazy', {
      description: '',
      examples: [],
      handler: ({ args, node }) => {
        expectTypeOf(args).toEqualTypeOf<undefined>();
        expectTypeOf(node.args).toEqualTypeOf<AST.AstNode[]>();

        return new FormulaNumber(0);
      },
    });
  });
});

describe('RoutinesRegistry.registerMethod handler types', () => {
  it('should type the instance and the arguments from the signature', () => {
    registry.registerMethod(FormulaDateTime, 'shift', {
      description: '',
      examples: [],
      arguments: [arg.duration('duration')],
      handler: ({ instance, args }) => {
        expectTypeOf(instance).toEqualTypeOf<FormulaDateTime>();
        expectTypeOf(args).toEqualTypeOf<[FormulaDuration]>();

        return instance;
      },
    });
  });
});
