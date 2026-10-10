import type { FormulaDataType } from '../../data-types';
import type { ArgumentsPattern } from '../arguments';
import type { Routine } from '../routine';

import { fc } from '@fast-check/vitest';

import { formulaValueArbitrary } from '../../../testing-library';
import { Kind } from '../../data-types';
import { CallbackArgument } from '../arguments';

type RoutineForm = 'function' | 'method';

type ArgumentInput = { readonly value: FormulaDataType } | { readonly expression: string };

interface RoutineCallOptions {
  readonly name: string;
  readonly routine: Routine;
  readonly form: RoutineForm;
  /** Data type of the call subject in the method form. */
  readonly subjectKind?: Kind;
}

interface RoutineCall {
  readonly formula: string;
  readonly context: Readonly<Record<string, FormulaDataType>>;
}

const BOOLEAN_EXPRESSIONS = ['true', 'false', 'index > 1', 'index % 2 == 0', 'current == current', 'empty(current)'];

const ANY_EXPRESSIONS = ['current', 'index', 'null', 'current.format()', '[current, index]', '1 / (index + 1)'];

const anyArgument = formulaValueArbitrary().map((value): ArgumentInput => ({ value }));

/**
 * Generates calls of a routine that mostly fit one of its signatures, with edge values in every position,
 * and sometimes arbitrary arguments of any type and count.
 *
 * @remarks
 * Values reach the formula through context variables, so any host value fits, even one with no literal syntax.
 * A callback position gets an expression over `current` and `index`, or a value.
 */
export function routineCallArbitrary({ name, routine, form, subjectKind = Kind.Any }: RoutineCallOptions): fc.Arbitrary<RoutineCall> {
  const fitting = routine.signatures.map((signature) => ({ weight: 3, arbitrary: signatureArbitrary(signature) }));
  const args = fc.oneof({ weight: 1, arbitrary: fc.array(anyArgument, { maxLength: 4 }) }, ...fitting);

  if (form === 'function') {
    return args.map((inputs) => toCall({ prefix: `${name}(`, inputs }));
  }

  return fc.tuple(formulaValueArbitrary(subjectKind), args).map(([subject, inputs]) => {
    const call = toCall({ prefix: `subject.${name}(`, inputs });

    return { formula: call.formula, context: { ...call.context, subject } };
  });
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

function toCall({ prefix, inputs }: { readonly prefix: string; readonly inputs: readonly ArgumentInput[] }): RoutineCall {
  const context: Record<string, FormulaDataType> = {};
  const texts = inputs.map((input, index) => {
    if ('expression' in input) {
      return input.expression;
    }

    context[`value${index}`] = input.value;

    return `value${index}`;
  });

  return { formula: `${prefix}${texts.join(', ')})`, context };
}
