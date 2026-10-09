import type { RoutineExampleOptions } from '../routine-example';

import { FormulaNumber, FormulaString } from '../../data-types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';

// Text length counts user-perceived characters, so an emoji sequence like 👨‍👩‍👧 has length 1
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function countCharacters(text: string): number {
  return Array.from(graphemeSegmenter.segment(text)).length;
}

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('"hello"'),
    result: () => new FormulaNumber(5),
  },
  {
    formula: (name) => name('""'),
    result: () => new FormulaNumber(0),
  },
  {
    formula: (name) => name('[1, 2, 3]'),
    result: () => new FormulaNumber(3),
  },
  {
    formula: (name) => name('[]'),
    result: () => new FormulaNumber(0),
  },
];

routinesRegistry.registerRoutine('length', {
  description: 'Returns the length of the text or list.',
  examples: routineExamples,
  arguments: [
    [arg.string('text')],
    [arg.array('list')],
  ],
  handler: ({ subject }) => {
    if (subject instanceof FormulaString) {
      return new FormulaNumber(countCharacters(subject.value));
    }

    return new FormulaNumber(subject.value.length);
  },
});
