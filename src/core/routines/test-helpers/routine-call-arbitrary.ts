import type { FormulaDataType } from '../../data-types';
import type { ArgumentsPattern } from '../arguments';

import { fc } from '@fast-check/vitest';

import { formulaValueArbitrary } from '../../../testing-library';
import { Kind } from '../../data-types';
import { CallbackArgument } from '../arguments';

type ArgumentInput = { readonly value: FormulaDataType } | { readonly expression: string };

interface RoutineCallOptions {
  /** Signatures to fit; for a method, the arguments inside the parentheses. */
  readonly signatures: readonly ArgumentsPattern[];
  /** Data type of the call subject, generated in front of the arguments; omitted for a function's own signatures. */
  readonly subjectKind?: Kind;
}

interface Formula {
  readonly formula: string;
  readonly context: Readonly<Record<string, FormulaDataType>>;
}

const BOOLEAN_EXPRESSIONS = ['true', 'false', 'index > 1', 'index % 2 == 0', 'current == current', 'empty(current)'];

const ANY_EXPRESSIONS = ['current', 'index', 'null', 'current.format()', '[current, index]', '1 / (index + 1)'];

const anyArgument = formulaValueArbitrary().map((value): ArgumentInput => ({ value }));

/** Arguments of one call, written out as `f(x, a)` or as `x.f(a)` with the first argument as the subject. */
class RoutineCall {
  readonly #inputs: readonly ArgumentInput[];

  constructor(inputs: readonly ArgumentInput[]) {
    this.#inputs = inputs;
  }

  asFunction(name: string): Formula {
    const { texts, context } = this.#write();

    return { formula: `${name}(${texts.join(', ')})`, context };
  }

  asMethod(name: string): Formula {
    const { texts: [subject = 'null', ...args], context } = this.#write();

    return { formula: `(${subject}).${name}(${args.join(', ')})`, context };
  }

  [fc.toStringMethod](): string {
    const { formula, context } = this.asFunction('f');

    return `${formula} with ${Object.entries(context).map(([name, value]) => `${name} = ${value.constructor.name}(${value.toString({ asJSON: true })})`).join(', ')}`;
  }

  #write(): { readonly texts: string[]; readonly context: Record<string, FormulaDataType> } {
    const context: Record<string, FormulaDataType> = {};
    const texts = this.#inputs.map((input, index) => {
      if ('expression' in input) {
        return input.expression;
      }

      context[`value${index}`] = input.value;

      return `value${index}`;
    });

    return { texts, context };
  }
}

/**
 * Generates calls that mostly fit one of the signatures, with edge values in every position,
 * and sometimes arbitrary arguments of any type and count.
 *
 * @remarks
 * Values reach the formula through context variables, so any host value fits, even one with no literal syntax.
 * A callback position gets an expression over `current` and `index`, or a value.
 */
export function routineCallArbitrary({ signatures, subjectKind }: RoutineCallOptions): fc.Arbitrary<RoutineCall> {
  const fitting = signatures.map((signature) => ({ weight: 3, arbitrary: signatureArbitrary(signature) }));
  const args = fc.oneof({ weight: 1, arbitrary: fc.array(anyArgument, { maxLength: 4 }) }, ...fitting);

  if (subjectKind === undefined) {
    return args.map((inputs) => new RoutineCall(inputs));
  }

  return fc.tuple(formulaValueArbitrary(subjectKind), args).map(([subject, inputs]) => new RoutineCall([{ value: subject }, ...inputs]));
}

// Helpers

function signatureArbitrary(signature: ArgumentsPattern): fc.Arbitrary<ArgumentInput[]> {
  const positions = signature.map((argument) => {
    const single = argument instanceof CallbackArgument ? callbackArbitrary(argument) : valueArbitrary(argument.types);

    if (!(argument instanceof CallbackArgument) && argument.repeatable) {
      return fc.array(single, { minLength: argument.optional ? 0 : 1, maxLength: 3 });
    }

    return single.map((input) => [input]);
  });
  const requiredCount = signature.filter((argument) => !argument.optional).length;

  return fc.tuple(fc.tuple(...positions), fc.integer({ min: requiredCount, max: signature.length })).map(([groups, count]) => groups.slice(0, count).flat());
}

function valueArbitrary(types: Kind | readonly Kind[]): fc.Arbitrary<ArgumentInput> {
  const kinds = Array.isArray(types) ? types : [types];
  const fitting = fc.oneof(...kinds.map((kind) => formulaValueArbitrary(kind))).map((value): ArgumentInput => ({ value }));

  return fc.oneof({ weight: 9, arbitrary: fitting }, { weight: 1, arbitrary: anyArgument });
}

function callbackArbitrary(callback: CallbackArgument): fc.Arbitrary<ArgumentInput> {
  const returnsBoolean = callback.returnType === Kind.Boolean;
  const expressions = returnsBoolean ? BOOLEAN_EXPRESSIONS : [...ANY_EXPRESSIONS, ...BOOLEAN_EXPRESSIONS];
  const expression = fc.constantFrom(...expressions).map((text): ArgumentInput => ({ expression: text }));

  return fc.oneof({ weight: 9, arbitrary: expression }, { weight: 1, arbitrary: anyArgument });
}
