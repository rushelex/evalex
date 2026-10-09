import { FormulaArray, FormulaNumber, FormulaString, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

// Text length counts user-perceived characters, so an emoji sequence like 👨‍👩‍👧 has length 1
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function countCharacters(text: string): number {
  return Array.from(graphemeSegmenter.segment(text)).length;
}

const routineExamples = createRoutineExamples([
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
]);

routinesRegistry.registerRoutine('length', {
  on: [FormulaString, FormulaArray],
  description: 'Returns the length of the text or list.',
  examples: routineExamples,
  arguments: createRoutineArguments([
    [new Argument(Kind.String, { name: 'text' })],
    [new Argument(Kind.Array, { name: 'list' })],
  ]),
  handler: ({ subject }) => {
    if (subject instanceof FormulaString) {
      return new FormulaNumber(countCharacters(subject.value));
    }

    return new FormulaNumber(subject.value.length);
  },
});
