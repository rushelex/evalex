import { FormulaRegExp, FormulaString } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"replace" method routine', new RoutineTester('replace').examples({
  skipFunction: true,
}, [
  {
    formula: '"Hello world".replace("world", "universe")',
    expected: new FormulaString('Hello universe'),
  },
  {
    formula: '"Hello 123 world 456".replace("\\\\d+", "XXX")',
    expected: new FormulaString('Hello XXX world 456'),
  },
  {
    formula: '"Hello WORLD".replace(/world/i, "universe")',
    expected: new FormulaString('Hello universe'),
  },
  {
    formula: '"Hello world".replace("\\\\d+", "XXX")',
    expected: new FormulaString('Hello world'),
  },
  {
    formula: '"Hello hello".replace("hello", "hi")',
    expected: new FormulaString('Hello hi'),
  },
  {
    formula: '"a.b.c".replace(".", "-")',
    expected: new FormulaString('-.b.c'),
  },
  {
    formula: '"a1b2".replace(/\\d/g, "#")',
    expected: new FormulaString('a#b#'),
  },
  {
    formula: '"a1b2".replace("\\\\d", "#", "g")',
    expected: {
      method: {
        message: 'Expected 2 arguments.',
        location: [7, 14],
      },
    },
  },
  {
    formula: '"John Smith".replace("(\\\\w+) (\\\\w+)", "$2 $1")',
    expected: new FormulaString('Smith John'),
  },
  {
    formula: '"abc".replace("b", "[$&]")',
    expected: new FormulaString('a[b]c'),
  },
  {
    formula: '"abc".replace("", "-")',
    expected: new FormulaString('-abc'),
  },
  {
    formula: '"aXbX".replace(regexp, "-")',
    context: {
      regexp: new FormulaRegExp('x', 'i'),
    },
    expected: new FormulaString('a-bX'),
  },
  {
    formula: '"aXbX".replace(regexp, "-")',
    context: {
      regexp: new FormulaRegExp('x', 'gi'),
    },
    expected: new FormulaString('a-b-'),
  },
  {
    formula: '"test".replace("[", "replacement")',
    expected: {
      method: {
        message: 'Invalid regular expression: /[/: Unterminated character class.',
        location: [7, 14],
      },
    },
  },
]));
