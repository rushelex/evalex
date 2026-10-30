import type { RoutineExampleOptions } from '../routine-example';

import { FormulaArray, FormulaString } from '../../data-types';
import { getRegExpFallbackError } from '../../errors';
import { type } from '../../types';
import { arg } from '../arguments';
import { routinesRegistry } from '../registry';
import { splitGraphemes } from './split-graphemes';

const routineExamples: readonly RoutineExampleOptions[] = [
  {
    formula: (name) => name('"apple,pear,orange"', '","'),
    result: () => FormulaArray.from(['apple', 'pear', 'orange']),
  },
  {
    formula: (name) => name('"v1.2.3"', '"."'),
    result: () => FormulaArray.from(['v1', '2', '3']),
  },
  {
    formula: (name) => name('"a1b22c"', '/\\d+/'),
    result: () => FormulaArray.from(['a', 'b', 'c']),
  },
];

routinesRegistry.registerRoutine('split', {
  description: 'Returns the parts of the text between matches of the separator.',
  examples: routineExamples,
  arguments: [arg.string('text'), arg.pattern('separator')],
  returns: type.array(type.string),
  handler: ({ subject, args: [separator], locations, visitor }) => {
    const toList = (parts: readonly string[]) => new FormulaArray(parts.map((part) => new FormulaString(part)));

    // A text separator is plain text, so "." splits at dots; an empty one splits into characters
    if (separator instanceof FormulaString) {
      return toList(separator.value === '' ? splitGraphemes(subject.value) : subject.value.split(separator.value));
    }

    try {
      return toList(subject.value.split(separator.toRegExp()));
    }
    catch (error) {
      throw getRegExpFallbackError(error, locations[0], visitor.formula);
    }
  },
});
