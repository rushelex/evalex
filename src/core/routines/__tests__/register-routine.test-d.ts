import type { AST } from '../../../parser';
import type { FormulaBoolean, FormulaDataType, FormulaDuration, FormulaNull, FormulaRegExp } from '../../data-types';
import type { CallbackExecutor, ChoiceValue } from '../arguments';

import { FormulaArray, FormulaDateTime, FormulaNumber, FormulaString } from '../../data-types';
import { type } from '../../types';
import { arg } from '../arguments';
import { RoutinesRegistry } from '../registry';

const registry = new RoutinesRegistry();

describe('RoutinesRegistry.registerRoutine handler types', () => {
  it('should type the subject and the arguments from a single signature', () => {
    registry.registerRoutine('replace', {
      description: '',
      examples: [],
      arguments: [arg.string('text'), arg.pattern('pattern'), arg.string('replacement')],
      returns: type.string,
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
      returns: type.array(type.any),
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
      arguments: [arg('numbers', type.union(type.array(type.any), type.number), { repeatable: true })],
      returns: type.union(type.array(type.any), type.number),
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
      returns: [type.dateTime, type.dateTime],
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
      returns: type.dateTime,
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
      arguments: [arg.array('list'), arg.callback('predicate', { variables: ['current', 'index'], returns: type.boolean })],
      returns: type.array(type.any),
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
      arguments: [arg.array('list'), arg.eachItem('predicate', { returns: type.boolean })],
      returns: type.array(type.any),
      handler: ({ subject, args: [predicate] }) => {
        expectTypeOf(predicate).toEqualTypeOf<CallbackExecutor<'current' | 'index', FormulaBoolean>>();

        return subject;
      },
    });
  });

  it('should type an argument of a type built with `type` by the kinds a call checks, leaving the items of a list unchecked', () => {
    registry.registerRoutine('total', {
      description: '',
      examples: [],
      arguments: [arg('list', type.array(type.number)), arg('fallback', type.union(type.number, type.null), { optional: true })],
      returns: type.number,
      handler: ({ subject, args }) => {
        expectTypeOf(subject).toEqualTypeOf<FormulaArray>();
        expectTypeOf(args).toEqualTypeOf<[(FormulaNumber | FormulaNull)?]>();

        return new FormulaNumber(0);
      },
    });
  });

  it('should give a value of a type variable as any value, and take any value as its result', () => {
    const T = type.variable('T');

    registry.registerRoutine('head', {
      description: '',
      examples: [],
      arguments: [arg('list', type.array(T))],
      returns: T,
      handler: ({ subject }) => {
        expectTypeOf(subject.value).toEqualTypeOf<readonly FormulaDataType[]>();

        return subject.value[0] ?? new FormulaNumber(0);
      },
    });
  });

  it('should reject a callback as the call subject', () => {
    registry.registerRoutine('broken', {
      description: '',
      examples: [],
      // @ts-expect-error The subject must be a value.
      arguments: [arg.callback('predicate', { variables: ['current'] })],
      returns: type.number,
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
      returns: type.number,
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
      returns: type.number,
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
      returns: type.number,
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
      returns: type.dateTime,
      handler: ({ instance, args }) => {
        expectTypeOf(instance).toEqualTypeOf<FormulaDateTime>();
        expectTypeOf(args).toEqualTypeOf<[FormulaDuration]>();

        return instance;
      },
    });
  });
});

describe('RoutinesRegistry returns types', () => {
  it('should reject a handler that may return a value the declared type does not describe', () => {
    registry.registerRoutine('half', {
      description: '',
      examples: [],
      arguments: [arg.number('number')],
      returns: type.number,
      // @ts-expect-error The handler may return text, which `returns` does not describe.
      handler: ({ subject }) => (subject.value > 0 ? subject : new FormulaString('')),
    });
  });

  it('should check the items of a list', () => {
    registry.registerRoutine('words', {
      description: '',
      examples: [],
      arguments: [arg.string('text')],
      returns: type.array(type.number),
      // @ts-expect-error The items are text, not numbers.
      handler: ({ subject }) => new FormulaArray([subject]),
    });
  });

  it('should take one type per signature of a list and check the handler against all of them', () => {
    registry.registerRoutine('same', {
      description: '',
      examples: [],
      arguments: [[arg.string('text')], [arg.number('number')]],
      returns: [type.string, type.number],
      handler: ({ subject }) => subject,
    });

    registry.registerRoutine('sameText', {
      description: '',
      examples: [],
      arguments: [[arg.string('text')], [arg.number('number')]],
      returns: [type.string, type.string],
      // @ts-expect-error A number is not text.
      handler: ({ subject }) => subject,
    });
  });

  it('should require one type per signature of a list, and one type for one signature', () => {
    registry.registerRoutine('short', {
      description: '',
      examples: [],
      arguments: [[arg.string('text')], [arg.number('number')]],
      // @ts-expect-error One type for two signatures.
      returns: [type.number],
      handler: () => new FormulaNumber(0),
    });

    registry.registerRoutine('listed', {
      description: '',
      examples: [],
      arguments: [arg.number('number')],
      // @ts-expect-error A list for one signature.
      returns: [type.number],
      handler: () => new FormulaNumber(0),
    });
  });

  it('should allow no result for a type not built with `type`', () => {
    registry.registerFunction('plain', {
      description: '',
      examples: [],
      returns: { kind: 'Number' },
      // @ts-expect-error The plain type carries no class to check the handler against.
      handler: () => new FormulaNumber(0),
    });
  });
});
