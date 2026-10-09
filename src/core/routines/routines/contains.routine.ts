import type { FormulaRegExp } from '../../data-types';
import type { ProcessedArgument } from '../arguments';

import { FormulaBoolean, FormulaString, Kind } from '../../data-types';
import { Argument, createRoutineArguments } from '../arguments';
import { routinesRegistry } from '../registry';
import { createRoutineExamples } from '../routine-examples';

routinesRegistry.registerRoutine('contains', {
  on: [FormulaString],
  description: 'Tests whether the string contains the text or a regex match.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello world"', '"wor"'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"v1.2"', '"."'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"v1.2"', '/\\d\\.\\d/'),
      result: () => new FormulaBoolean(true),
    },
  ]),
  arguments: createRoutineArguments([
    new Argument(Kind.String, { name: 'text' }),
    new Argument([Kind.String, Kind.RegExp], { name: 'search' }),
  ]),
  handler: ({ subject, args }) => {
    const [searchArg] = args as [ProcessedArgument<FormulaString | FormulaRegExp>];

    // A string argument is plain text, so regex metacharacters like "." match literally
    if (searchArg.dataType instanceof FormulaString) {
      return new FormulaBoolean(subject.value.includes(searchArg.dataType.value));
    }

    return new FormulaBoolean(searchArg.dataType.toRegExp().test(subject.value));
  },
});
