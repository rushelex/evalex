import type { FormulaType } from '../../types';
import type { RoutineExample } from '../routine-example';

import { evaluate, matchesType } from '../../../testing-library';
import { ALL_DATA_TYPES } from '../../data-types';
import { parseFormula } from '../../parse-formula';
import { routinesRegistry } from '../registry';

// Examples document the current date as 2025-08-02, so the clock is frozen on that day.
vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(Temporal.ZonedDateTime.from('2025-08-02T10:30:00+00:00[UTC]'));

const functionExamples = [...routinesRegistry.getFunctions()].flatMap(([name, routine]) => {
  return routine.examples.map((example) => ({ name, form: 'function' as const, label: 'function', example }));
});

const methodExamples = routinesRegistry.getRegisteredDataTypes().flatMap((ctor) => {
  return [...routinesRegistry.getMethods(ctor)].flatMap(([name, routine]) => {
    return routine.examples.map((example) => ({ name, form: 'method' as const, label: `${ctor.name} method`, example }));
  });
});

const examples = uniqueByFormula([...functionExamples, ...methodExamples]);

describe('built-in routine examples', () => {
  it('should include examples of every registered routine', () => {
    const namesWithExamples = new Set(examples.map(({ name }) => name));
    const registeredNames = new Set([
      ...routinesRegistry.getFunctions().keys(),
      ...routinesRegistry.getRegisteredDataTypes().flatMap((ctor) => [...routinesRegistry.getMethods(ctor).keys()]),
    ]);

    expect(namesWithExamples).toEqual(registeredNames);
  });

  it.each(examples)('$name as $label: $example.formula', ({ example, form }) => {
    expect(example).toBeCorrectRoutineExample(form);
  });

  // Over records, the result is the list of the cells rather than what one call returns
  it.each(examples.flatMap(({ name, example }) => (example.result && !example.records ? [{ name, formula: example.formula, result: example.result() }] : [])))(
    'should return a type the signatures taking its value declare: $formula',
    ({ name, formula, result }) => {
      expect(declaredResults(name, formula).some((type) => matchesType(result, type))).toBe(true);
    },
  );
});

// Helpers

function uniqueByFormula<T extends { readonly example: RoutineExample }>(items: readonly T[]): T[] {
  const byFormula = new Map<string, T>();

  for (const item of items) {
    if (!byFormula.has(item.example.formula)) {
      byFormula.set(item.example.formula, item);
    }
  }

  return [...byFormula.values()];
}

/**
 * The result types of the signatures that take the value a call is made on: the method of its type has only those.
 * A routine without a method form declares the results of all its signatures.
 */
function declaredResults(name: string, formula: string): readonly FormulaType[] {
  const call = parseFormula(formula);

  if (call.type !== 'CallExpression') {
    return [];
  }

  const isMethodCall = call.callee.type === 'MemberExpression';
  const subjectNode = call.callee.type === 'MemberExpression' ? call.callee.object : call.args[0];
  const methodName = isMethodCall ? name : routinesRegistry.getMethodName(name);

  if (!subjectNode || !methodName) {
    return routinesRegistry.getFunction(name)?.results ?? [];
  }

  const subject = evaluate(formula.slice(subjectNode.location.start.offset, subjectNode.location.end.offset));
  const dataType = ALL_DATA_TYPES.find(({ kind }) => kind === subject.kind);

  return (dataType && routinesRegistry.getMethods(dataType).get(methodName)?.results) ?? [];
}
