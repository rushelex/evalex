import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('-0.6'),
    result: () => new FormulaNumber(-1),
  },
  {
    formula: (name) => name('1.234', '2'),
    result: () => new FormulaNumber(1.23),
  },
  {
    formula: (name) => name('1234', '-2'),
    result: () => new FormulaNumber(1200),
  },
];

routinesRegistry.registerRoutine('round', {
  description: 'Rounds the number to the nearest integer or to the given places.',
  examples: routineExamples,
  arguments: [
    arg.number('number'),
    arg.number('places', {
      optional: true,
      validation: (places) => (Number.isInteger(places.value) ? undefined : { message: 'Expected integer.', expected: ['integer'], actual: places.value }),
    }),
  ],
  handler: ({ subject, args: [places] }) => FormulaNumber.from(round(subject.value, places?.value ?? 0)),
});

// Shifts the decimal point in the text form of the number, so that 1.005 rounds to 1.01 instead of drifting to 1.
function round(value: number, places: number): number {
  const shifted = shift(value, places);

  if (!Number.isFinite(shifted)) {
    return value;
  }

  return shift(Math.round(shifted), -places);
}

function shift(value: number, places: number): number {
  const [mantissa, exponent = '0'] = String(value).split('e');

  return Number(`${mantissa}e${Number(exponent) + places}`);
}
