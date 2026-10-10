import type { RoutineExampleOptions } from '../routine-example';

import { FormulaString } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { expectInteger } from './expect-integer';
import { splitGraphemes } from './split-graphemes';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('"Formula"', '0', '3'),
    result: () => new FormulaString('For'),
  },
  {
    formula: (name) => name('"Formula"', '3'),
    result: () => new FormulaString('mula'),
  },
];

routinesRegistry.registerRoutine('substring', {
  description: 'Returns the text from the start index up to the end index.',
  examples: routineExamples,
  arguments: [
    arg.string('text'),
    arg.number('start', { validation: expectInteger }),
    arg.number('end', { optional: true, validation: expectInteger }),
  ],
  // Indexes below 0 or past the end are clamped, and a start after the end swaps them, as in JavaScript
  handler: ({ subject, args: [start, end] }) => {
    const characters = splitGraphemes(subject.value);
    const clamp = (index: number): number => Math.min(Math.max(index, 0), characters.length);
    const [from, to] = [clamp(start.value), clamp(end?.value ?? characters.length)].toSorted((a, b) => a - b);

    return new FormulaString(characters.slice(from, to).join(''));
  },
});
