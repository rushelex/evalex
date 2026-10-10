import type { RoutineExampleOptions } from '../routine-example';

import { FormulaString } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { expectInteger } from './expect-integer';
import { fillToLength } from './fill-to-length';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('"5"', '3', '"0"'),
    result: () => new FormulaString('005'),
  },
  {
    formula: (name) => name('"5"', '3', '"."'),
    result: () => new FormulaString('..5'),
  },
];

routinesRegistry.registerRoutine('padStart', {
  description: 'Pads the start of the text with the padding up to the length.',
  examples: routineExamples,
  arguments: [
    arg.string('text'),
    arg.number('length', { validation: expectInteger }),
    arg.string('padding', { optional: true }),
  ],
  handler: ({ subject, args: [length, padding], locations }) => {
    const fill = fillToLength({ text: subject.value, length: length.value, padding: padding?.value ?? ' ', lengthLocation: locations[0] });

    return new FormulaString(fill + subject.value);
  },
});
