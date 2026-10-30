import { routinesRegistry } from '../registry';

const routines = [
  ...routinesRegistry.getFunctions(),
  ...routinesRegistry.getRegisteredDataTypes().flatMap((ctor) => [...routinesRegistry.getMethods(ctor)]),
].map(([name, routine]) => ({ name, description: routine.description }));

describe('built-in routine descriptions', () => {
  // Descriptions are shown in UI tooltips, which fit 65 characters.
  it.each(routines)('$name: $description', ({ description }) => {
    expect(description.length).toBeLessThanOrEqual(65);
  });
});
