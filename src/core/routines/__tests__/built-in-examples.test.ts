import type { RoutineExample } from '../routine-example';

import { Temporal } from 'temporal-polyfill';

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
