import type { Kind } from '../data-types';
import type { FormulaRoutine, FormulaRoutineParameter } from '../formula-routine';
import type { ArgumentsPattern } from './arguments';
import type { RoutinesRegistry } from './registry';

import { ALL_DATA_TYPES } from '../data-types';
import { CallbackArgument } from './arguments';

interface MethodEntry {
  readonly name: string;
  readonly description: string;
  readonly kinds: Kind[];
  readonly signatures: Map<string, { readonly kinds: Kind[]; readonly parameters: readonly FormulaRoutineParameter[] }>;
}

/**
 * Lists the routines of a registry as data: every function, and every method once per meaning with the kinds that have it.
 *
 * @remarks
 * The registry keeps a method per data type. Methods of one name and description are one routine; a name with two
 * descriptions, such as `add` of numbers and of dates, is two. Equal argument lists of a routine are joined with the
 * kinds that accept them, in the order of the data types. Entries are sorted by name, a function before the methods.
 */
export function routineCatalog(registry: RoutinesRegistry): FormulaRoutine[] {
  const functions = [...registry.getFunctions()].map(([name, routine]): FormulaRoutine => ({
    name,
    form: 'function',
    description: routine.description,
    kinds: [],
    signatures: routine.signatures.map((pattern) => ({ kinds: [], parameters: pattern.map(toParameter) })),
  }));
  const methods = new Map<string, MethodEntry>();

  for (const ctor of ALL_DATA_TYPES) {
    for (const [name, routine] of registry.getMethods(ctor)) {
      const key = JSON.stringify([name, routine.description]);
      const entry = methods.get(key) ?? { name, description: routine.description, kinds: [], signatures: new Map() };

      methods.set(key, entry);
      entry.kinds.push(ctor.kind);

      for (const parameters of routine.signatures.map((pattern) => pattern.map(toParameter))) {
        const signatureKey = JSON.stringify(parameters);
        const signature = entry.signatures.get(signatureKey) ?? { kinds: [], parameters };

        entry.signatures.set(signatureKey, signature);
        signature.kinds.push(ctor.kind);
      }
    }
  }

  const methodRoutines = [...methods.values()].map(({ name, description, kinds, signatures }): FormulaRoutine => ({
    name,
    form: 'method',
    description,
    kinds,
    signatures: [...signatures.values()],
  }));

  // The sort is stable, so a function stays before the methods of its name.
  return [...functions, ...methodRoutines].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

function toParameter(argument: ArgumentsPattern[number]): FormulaRoutineParameter {
  const { name } = argument;

  if (argument instanceof CallbackArgument) {
    return { name, kinds: [argument.returnType].flat(), optional: argument.optional, repeatable: false, variables: argument.contextVariables };
  }

  return { name, kinds: [argument.types].flat(), optional: argument.optional, repeatable: argument.repeatable };
}
