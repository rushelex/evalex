import { FormulaNumber } from '../../data-types';
import { RoutineExample } from '../routine-example';

describe('RoutineExample', () => {
  describe('initialization', () => {
    it('should initialize with provided name, formula and result', () => {
      const example = new RoutineExample('example', {
        formula: () => '1 + 1',
        result: () => new FormulaNumber(2),
      });
      expect(example.routineName).toBe('example');
      expect(example.formula).toBe('1 + 1');
      expect(example.result()).toBeFormulaDataType(FormulaNumber, 2);
    });

    it('should convert function notation of formula', () => {
      const example = new RoutineExample('format', {
        formula: (routine) => routine('[1,2,3]', '"hello"', '42'),
        result: () => new FormulaNumber(2),
      });
      expect(example.toFunctionCall()).toBe('format([1,2,3], "hello", 42)');
      expect(example.toMethodCall()).toBe('[1,2,3].format("hello", 42)');
    });
  });

  describe('toFunctionCall', () => {
    it('should transform method call to function call', () => {
      const example = new RoutineExample('format', {
        formula: (name) => name('[1,2,3]'),
        result: () => new FormulaNumber(2),
      });
      expect(example.toFunctionCall()).toBe('format([1,2,3])');
    });

    it('should return formula as is if it is not a method call', () => {
      const example = new RoutineExample('format', {
        formula: (name) => name('[1,2,3]'),
        result: () => new FormulaNumber(2),
      });
      expect(example.toFunctionCall()).toBe('format([1,2,3])');
    });

    it('should correctly convert simple method calls (ported)', () => {
      const ex1 = new RoutineExample('length', {
        formula: (name) => name('"hello"'),
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toFunctionCall()).toBe('length("hello")');

      const ex2 = new RoutineExample('sum', {
        formula: (name) => name('5'),
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toFunctionCall()).toBe('sum(5)');
    });

    it('should correctly convert method calls with arrays (ported)', () => {
      const ex1 = new RoutineExample('length', {
        formula: (name) => name('[1, 2, 3]'),
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toFunctionCall()).toBe('length([1, 2, 3])');

      const ex2 = new RoutineExample('sum', {
        formula: (name) => name('[1, 2, 3, 4]'),
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toFunctionCall()).toBe('sum([1, 2, 3, 4])');
    });

    it('should correctly convert method calls with nested arrays (ported)', () => {
      const ex = new RoutineExample('length', {
        formula: () => '[[1, 2], [3, 4]].length()',
        result: () => new FormulaNumber(0),
      });
      expect(ex.toFunctionCall()).toBe('length([[1, 2], [3, 4]])');
    });

    it('should correctly convert method calls with multiple arguments (ported)', () => {
      const ex1 = new RoutineExample('map', {
        formula: (name) => name('[1, 2, 3]', 'current * 2'),
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toFunctionCall()).toBe('map([1, 2, 3], current * 2)');

      const ex2 = new RoutineExample('filter', {
        formula: (name) => name('[1, 2, 3]', 'current > 1'),
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toFunctionCall()).toBe('filter([1, 2, 3], current > 1)');
    });

    it('should correctly convert method calls with objects (ported)', () => {
      const ex = new RoutineExample('format', {
        formula: (name) => name('{name: "John", age: 30}'),
        result: () => new FormulaNumber(0),
      });
      expect(ex.toFunctionCall()).toBe('format({name: "John", age: 30})');
    });

    it('should correctly convert method calls with strings containing commas (ported)', () => {
      const ex1 = new RoutineExample('length', {
        formula: (name) => name('"hello, world"'),
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toFunctionCall()).toBe('length("hello, world")');

      const ex2 = new RoutineExample('join', {
        formula: (name) => name('["a", "b"]', '", "'),
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toFunctionCall()).toBe('join(["a", "b"], ", ")');
    });

    it('should correctly convert method calls with mixed argument types (ported)', () => {
      const ex1 = new RoutineExample('slice', {
        formula: (name) => name('[1, 2, 3, 4]', '1', '3'),
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toFunctionCall()).toBe('slice([1, 2, 3, 4], 1, 3)');

      const ex2 = new RoutineExample('format', {
        formula: (name) => name('{value: [1, 2]}', '"json"'),
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toFunctionCall()).toBe('format({value: [1, 2]}, "json")');
    });

    it('should return formula as is if not matching pattern (ported)', () => {
      const ex1 = new RoutineExample('length', {
        formula: (name) => name('"hello"'),
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toFunctionCall()).toBe('length("hello")');

      const ex2 = new RoutineExample('length', {
        formula: () => 'someOtherFunction()',
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toFunctionCall()).toBe('someOtherFunction()');
    });
  });

  describe('toMethodCall', () => {
    it('should transform function call to method call', () => {
      const example = new RoutineExample('format', {
        formula: (name) => name('[1,2,3]'),
        result: () => new FormulaNumber(2),
      });
      expect(example.toMethodCall()).toBe('[1,2,3].format()');
    });

    it('should return formula as is if it is not a function call', () => {
      const example = new RoutineExample('format', {
        formula: () => '[1,2,3].format()',
        result: () => new FormulaNumber(2),
      });
      expect(example.toMethodCall()).toBe('[1,2,3].format()');
    });

    it('should correctly convert simple function calls (ported)', () => {
      const ex1 = new RoutineExample('length', {
        formula: () => 'length("hello")',
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toMethodCall()).toBe('"hello".length()');

      const ex2 = new RoutineExample('sum', {
        formula: (name) => name('5'),
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toMethodCall()).toBe('5.sum()');
    });

    it('should correctly convert function calls with arrays (ported)', () => {
      const ex1 = new RoutineExample('length', {
        formula: (name) => name('[1, 2, 3]'),
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toMethodCall()).toBe('[1, 2, 3].length()');

      const ex2 = new RoutineExample('sum', {
        formula: (name) => name('[1, 2, 3, 4]'),
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toMethodCall()).toBe('[1, 2, 3, 4].sum()');
    });

    it.each([
      { formula: 'sum(-1)', expected: '(-1).sum()' },
      { formula: 'sum(a + b, 2)', expected: '(a + b).sum(2)' },
      { formula: 'sum(if(flag, 1, 2))', expected: 'if(flag, 1, 2).sum()' },
      { formula: 'sum(items)', expected: 'items.sum()' },
    ])('should wrap a compound subject in parentheses: $formula', ({ formula, expected }) => {
      const example = new RoutineExample('sum', {
        formula: () => formula,
        result: () => new FormulaNumber(0),
      });

      expect(example.toMethodCall()).toBe(expected);
    });

    it('should correctly convert function calls with nested arrays (ported)', () => {
      const ex = new RoutineExample('length', {
        formula: (name) => name('[[1, 2], [3, 4]]'),
        result: () => new FormulaNumber(0),
      });
      expect(ex.toMethodCall()).toBe('[[1, 2], [3, 4]].length()');
    });

    it('should correctly convert function calls with multiple arguments (ported)', () => {
      const ex1 = new RoutineExample('map', {
        formula: (name) => name('[1, 2, 3]', 'current * 2'),
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toMethodCall()).toBe('[1, 2, 3].map(current * 2)');

      const ex2 = new RoutineExample('filter', {
        formula: (name) => name('[1, 2, 3]', 'current > 1'),
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toMethodCall()).toBe('[1, 2, 3].filter(current > 1)');
    });

    it('should correctly convert function calls with objects (ported)', () => {
      const ex = new RoutineExample('format', {
        formula: (name) => name('{name: "John", age: 30}'),
        result: () => new FormulaNumber(0),
      });
      expect(ex.toMethodCall()).toBe('{name: "John", age: 30}.format()');
    });

    it('should correctly convert function calls with strings containing commas (ported)', () => {
      const ex1 = new RoutineExample('length', {
        formula: (name) => name('"hello, world"'),
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toMethodCall()).toBe('"hello, world".length()');

      const ex2 = new RoutineExample('join', {
        formula: (name) => name('["a", "b"]', '", "'),
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toMethodCall()).toBe('["a", "b"].join(", ")');
    });

    it('should correctly convert function calls with mixed argument types (ported)', () => {
      const ex1 = new RoutineExample('slice', {
        formula: (name) => name('[1, 2, 3, 4]', '1', '3'),
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toMethodCall()).toBe('[1, 2, 3, 4].slice(1, 3)');

      const ex2 = new RoutineExample('format', {
        formula: (name) => name('{value: [1, 2]}', '"json"'),
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toMethodCall()).toBe('{value: [1, 2]}.format("json")');
    });

    it('should return formula as is if not matching pattern (ported)', () => {
      const ex1 = new RoutineExample('length', {
        formula: () => '[1, 2, 3].length()',
        result: () => new FormulaNumber(0),
      });
      expect(ex1.toMethodCall()).toBe('[1, 2, 3].length()');

      const ex2 = new RoutineExample('length', {
        formula: () => 'someOtherFunction()',
        result: () => new FormulaNumber(0),
      });
      expect(ex2.toMethodCall()).toBe('someOtherFunction()');
    });
  });
});
