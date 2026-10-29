import type { FormulaRoutine, FormulaRoutineParameter, FormulaRoutineSignature } from '../formula-routine';
import type { FormulaType } from '../types';
import type { ArgumentsPattern } from './arguments';
import type { RoutinesRegistry } from './registry';

import { ALL_DATA_TYPES, Kind } from '../data-types';
import { type } from '../types';
import { CallbackArgument } from './arguments';

interface MethodEntry {
  readonly name: string;
  readonly description: string;
  readonly kinds: Kind[];
  readonly signatures: Map<string, FormulaRoutineSignature>;
}

/**
 * Lists the routines of a registry as data: every function, and every method once per meaning with the kinds that have it.
 *
 * @remarks
 * The registry keeps a method per data type. Methods of one name and description are one routine; a name with two
 * descriptions, such as `add` of numbers and of dates, is two. Argument lists equal in subject, parameters and result
 * are joined, in the order of the data types. Entries are sorted by name, a function before the methods.
 */
export function routineCatalog(registry: RoutinesRegistry): FormulaRoutine[] {
  const functions = [...registry.getFunctions()].map(([name, routine]): FormulaRoutine => ({
    name,
    form: 'function',
    description: routine.description,
    kinds: [],
    signatures: routine.signatures.map((pattern, index) => ({ parameters: pattern.map(toParameter), returns: routine.results[index] })),
  }));
  const methods = new Map<string, MethodEntry>();

  for (const ctor of ALL_DATA_TYPES) {
    for (const [name, routine] of registry.getMethods(ctor)) {
      const key = JSON.stringify([name, routine.description]);
      const entry = methods.get(key) ?? { name, description: routine.description, kinds: [], signatures: new Map() };

      methods.set(key, entry);
      entry.kinds.push(ctor.kind);

      for (const [index, pattern] of routine.signatures.entries()) {
        // A method registered on one data type alone is called on values of that type.
        const signature = { subject: routine.subjects[index] ?? typeOfKind(ctor.kind), parameters: pattern.map(toParameter), returns: routine.results[index] };

        entry.signatures.set(JSON.stringify(signature), signature);
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

function typeOfKind(kind: Kind): FormulaType {
  return kind === Kind.Array ? type.array(type.any) : { kind };
}

function toParameter(argument: ArgumentsPattern[number]): FormulaRoutineParameter {
  const { name } = argument;

  if (argument instanceof CallbackArgument) {
    return { name, type: argument.returns, optional: argument.optional, repeatable: false, variables: argument.contextVariables };
  }

  const parameter = { name, type: argument.type, optional: argument.optional, repeatable: argument.repeatable };

  // Copies, because validation reads the same list: a host changing the catalog must not change what a formula accepts.
  return argument.choices ? { ...parameter, choices: [...argument.choices] } : parameter;
}
