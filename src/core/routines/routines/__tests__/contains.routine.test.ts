import { FormulaBoolean, FormulaRegExp } from '../../../data-types';
import { RoutineTester } from '../../test-helpers/routine-tester';

describe('"contains" method routine', new RoutineTester('contains').examples({
  skipFunction: true,
}, [
  {
    formula: '"Hello world".contains("wor")',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"Hello world".contains("xyz")',
    expected: new FormulaBoolean(false),
  },
  {
    formula: '"abc".contains("a.c")',
    expected: new FormulaBoolean(false),
  },
  {
    formula: '"a.c".contains(".")',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"f(x)".contains("(")',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"Hello".contains("hello")',
    expected: new FormulaBoolean(false),
  },
  {
    formula: '"abc".contains("")',
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"abc".contains(regexp)',
    context: {
      regexp: new FormulaRegExp('a.c', ''),
    },
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"Hello".contains(regexp)',
    context: {
      regexp: new FormulaRegExp('hello', 'i'),
    },
    expected: new FormulaBoolean(true),
  },
  {
    formula: '"Hello".contains("hello", "i")',
    expected: {
      method: {
        message: 'Expected 1 argument.',
        location: [8, 16],
      },
    },
  },
  {
    formula: '"abc".contains(42)',
    expected: {
      method: {
        message: 'Arguments don\'t match. Pattern 1: Expected type String.; Pattern 2: Expected type RegExp.',
        location: [6, 14],
      },
    },
  },
]));
