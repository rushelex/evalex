import type { ProcessedArgument } from '../../routines/arguments';

import { getRegExpFallbackError } from '../../errors';
import { Argument, createRoutineArguments } from '../../routines/arguments';
import { routinesRegistry } from '../../routines/registry';
import { createRoutineExamples } from '../../routines/routine-examples';
import { FormulaArray } from '../array';
import { FormulaBoolean } from '../boolean';
import { defineCoreMethods } from '../core-methods';
import { Kind } from '../kind';
import { FormulaNumber } from '../number';
import { FormulaRegExp } from '../regexp';
import { FormulaString } from './FormulaString';

defineCoreMethods(FormulaString);

routinesRegistry.registerMethod(FormulaString, 'upper', {
  description: 'Converts the string to uppercase.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"hello"'),
      result: () => new FormulaString('HELLO'),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaString(instance.value.toLocaleUpperCase());
  },
});

routinesRegistry.registerMethod(FormulaString, 'lower', {
  description: 'Converts the string to lowercase.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"HELLO"'),
      result: () => new FormulaString('hello'),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaString(instance.value.toLocaleLowerCase());
  },
});

routinesRegistry.registerMethod(FormulaString, 'length', {
  description: 'Returns the length of the string.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"hello"'),
      result: () => new FormulaNumber(5),
    },
    {
      formula: (name) => name('""'),
      result: () => new FormulaNumber(0),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaNumber(instance.value.length);
  },
});

routinesRegistry.registerMethod(FormulaString, 'trim', {
  description: 'Returns the string with leading and trailing whitespace removed.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"  hello  "'),
      result: () => new FormulaString('hello'),
    },
  ]),
  arguments: createRoutineArguments([]),
  handler: ({ instance }) => {
    return new FormulaString(instance.value.trim());
  },
});

routinesRegistry.registerMethod(FormulaString, 'match', {
  description: 'Returns an array of all matches found by the regular expression.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello 42 world 101"', '"\\\\d+"', '"g"'),
      result: () => new FormulaArray([new FormulaString('42'), new FormulaString('101')]),
    },
    {
      formula: (name) => name('"test@example.com"', '"@"'),
      result: () => new FormulaArray([new FormulaString('test@example.com')]),
    },
  ]),
  arguments: createRoutineArguments([
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.String, { name: 'pattern' }),
      new Argument(Kind.String, { name: 'flags', optional: true }),
    ],
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.RegExp, { name: 'regexp' }),
    ],
  ]),
  handler: ({ instance, args, location, visitor }) => {
    try {
      const [patternOrRegExpArg, flagsArg] = args as [ProcessedArgument<FormulaString>, ProcessedArgument<FormulaString>?] | [ProcessedArgument<FormulaRegExp>];

      const regexp = FormulaRegExp.from(patternOrRegExpArg.dataType.value, flagsArg?.dataType.value);

      const matches = instance.value.match(regexp.toRegExp());
      if (!matches) {
        return new FormulaArray([], 'string');
      }

      return new FormulaArray(matches.map((match) => new FormulaString(match)));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});

routinesRegistry.registerMethod(FormulaString, 'test', {
  description: 'Tests whether the string matches the regular expression.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello 123"', '"\\\\d+"'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"Hello world"', '"\\\\d+"'),
      result: () => new FormulaBoolean(false),
    },
  ]),
  arguments: createRoutineArguments([
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.String, { name: 'pattern' }),
      new Argument(Kind.String, { name: 'flags', optional: true }),
    ],
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.RegExp, { name: 'regexp' }),
    ],
  ]),
  handler: ({ instance, args, location, visitor }) => {
    try {
      const [patternOrRegExpArg, flagsArg] = args as [ProcessedArgument<FormulaString>, ProcessedArgument<FormulaString>?] | [ProcessedArgument<FormulaRegExp>];

      const regexp = FormulaRegExp.from(patternOrRegExpArg.dataType.value, flagsArg?.dataType.value);

      return new FormulaBoolean(regexp.toRegExp().test(instance.value));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});

routinesRegistry.registerMethod(FormulaString, 'replace', {
  description: 'Replaces the first match of the regular expression with the replacement string.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello world"', '"world"', '"universe"'),
      result: () => new FormulaString('Hello universe'),
    },
    {
      formula: (name) => name('"Hello 123 world 456"', '"\\\\d+"', '"XXX"'),
      result: () => new FormulaString('Hello XXX world 456'),
    },
  ]),
  arguments: createRoutineArguments([
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.String, { name: 'pattern' }),
      new Argument(Kind.String, { name: 'replacement' }),
      new Argument(Kind.String, { name: 'flags', optional: true }),
    ],
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.RegExp, { name: 'regexp' }),
      new Argument(Kind.String, { name: 'replacement' }),
    ],
  ]),
  handler: ({ instance, args, location, visitor }) => {
    try {
      const [patternOrRegExpArg, replacementArg, flagsArg] = args as [ProcessedArgument<FormulaString>, ProcessedArgument<FormulaString>, ProcessedArgument<FormulaString>?] | [ProcessedArgument<FormulaRegExp>, ProcessedArgument<FormulaString>];

      const regexp = FormulaRegExp.from(patternOrRegExpArg.dataType.value, flagsArg?.dataType.value);

      const replacement = replacementArg.dataType.value;

      return new FormulaString(instance.value.replace(regexp.toRegExp(), replacement));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});

routinesRegistry.registerMethod(FormulaString, 'replaceAll', {
  description: 'Replaces all matches of the regular expression with the replacement string.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello 123 world 456"', '"\\\\d+"', '"XXX"'),
      result: () => new FormulaString('Hello XXX world XXX'),
    },
  ]),
  arguments: createRoutineArguments([
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.String, { name: 'pattern' }),
      new Argument(Kind.String, { name: 'replacement' }),
      new Argument(Kind.String, { name: 'flags', optional: true }),
    ],
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.RegExp, { name: 'regexp' }),
      new Argument(Kind.String, { name: 'replacement' }),
    ],
  ]),
  handler: ({ instance, args, location, visitor }) => {
    try {
      const [patternOrRegExpArg, replacementArg, flagsArg] = args as [ProcessedArgument<FormulaString>, ProcessedArgument<FormulaString>, ProcessedArgument<FormulaString>?] | [ProcessedArgument<FormulaRegExp>, ProcessedArgument<FormulaString>];

      const regexp = FormulaRegExp.from(patternOrRegExpArg.dataType.value, flagsArg?.dataType.value);

      let regex = regexp.toRegExp();

      const replacement = replacementArg.dataType.value;

      // Ensure global flag for replaceAll
      if (!regex.global) {
        regex = new RegExp(regex.source, `g${regex.flags}`);
      }

      return new FormulaString(instance.value.replace(regex, replacement));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});

routinesRegistry.registerMethod(FormulaString, 'contains', {
  description: 'Tests whether the string contains a match for the regular expression.',
  examples: createRoutineExamples([
    {
      formula: (name) => name('"Hello world"', '"wor"'),
      result: () => new FormulaBoolean(true),
    },
    {
      formula: (name) => name('"Hello world"', '"\\\\d+"'),
      result: () => new FormulaBoolean(false),
    },
  ]),
  arguments: createRoutineArguments([
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.String, { name: 'pattern' }),
      new Argument(Kind.String, { name: 'flags', optional: true }),
    ],
    [
      new Argument(Kind.Array, { name: 'self' }),
      new Argument(Kind.RegExp, { name: 'regexp' }),
    ],
  ]),
  handler: ({ instance, args, location, visitor }) => {
    try {
      const [patternOrRegExpArg, flagsArg] = args as [ProcessedArgument<FormulaString>, ProcessedArgument<FormulaString>?] | [ProcessedArgument<FormulaRegExp>];

      const regexp = FormulaRegExp.from(patternOrRegExpArg.dataType.value, flagsArg?.dataType.value);

      return new FormulaBoolean(regexp.toRegExp().test(instance.value));
    }
    catch (error) {
      throw getRegExpFallbackError(error, location, visitor.formula);
    }
  },
});
