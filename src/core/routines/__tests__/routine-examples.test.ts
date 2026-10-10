import { FormulaNumber } from '../../data-types';
import { RoutineExample } from '../routine-example';
import { RoutineExamples } from '../routine-examples';

describe('RoutineExamples', () => {
  describe('initialization', () => {
    it('should create RoutineExample instances from options and preserve result', () => {
      const examples = new RoutineExamples('format', [
        {
          formula: (name) => name('"hello"', '42'),
          result: () => new FormulaNumber(2),
        },
        {
          formula: () => '"hello".format()',
          result: () => new FormulaNumber(3),
        },
      ]);

      expect(examples.examples).toHaveLength(2);
      expect(examples.examples[0]).toBeInstanceOf(RoutineExample);
      expect(examples.examples[0].routineName).toBe('format');
      expect(examples.examples[0].formula).toBe('format("hello", 42)');
      expect(examples.examples[0].result!()).toBeFormulaDataType(FormulaNumber, 2);

      expect(examples.examples[1]).toBeInstanceOf(RoutineExample);
      expect(examples.examples[1].routineName).toBe('format');
      expect(examples.examples[1].formula).toBe('"hello".format()');
      expect(examples.examples[1].result!()).toBeFormulaDataType(FormulaNumber, 3);
    });
  });

  describe('toFunctionExamples', () => {
    it('should return the same instance if example is already a function call, otherwise convert to a new instance', () => {
      const base = new RoutineExamples('format', [
        {
          formula: (name) => name('[1,2,3]'),
          result: () => new FormulaNumber(1),
        },
        {
          formula: () => '[1,2,3].format()',
          result: () => new FormulaNumber(2),
        },
      ]);

      const fnExamples = base.toFunctionExamples();

      // First is already a function call -> same instance
      expect(fnExamples[0]).toBe(base.examples[0]);
      expect(fnExamples[0].formula).toBe('format([1,2,3])');
      expect(fnExamples[0].result).toBe(base.examples[0].result);

      // Second is a method call -> converted to new instance
      expect(fnExamples[1]).not.toBe(base.examples[1]);
      expect(fnExamples[1]).toBeInstanceOf(RoutineExample);
      expect(fnExamples[1].formula).toBe('format([1,2,3])');
      // Result function must be preserved by reference
      expect(fnExamples[1].result).toBe(base.examples[1].result);
      // And still produce the same data when called
      expect(fnExamples[1].result!()).toBeFormulaDataType(FormulaNumber, 2);
    });
  });

  describe('toMethodExamples', () => {
    it('should return the same instance if example is already a method call, otherwise convert to a new instance', () => {
      const base = new RoutineExamples('format', [
        {
          formula: (name) => name('"hello"'),
          result: () => new FormulaNumber(10),
        },
        {
          formula: () => '"hello".format()',
          result: () => new FormulaNumber(20),
        },
      ]);

      const methodExamples = base.toMethodExamples();

      // Second is already a method call -> same instance
      expect(methodExamples[1]).toBe(base.examples[1]);
      expect(methodExamples[1].formula).toBe('"hello".format()');
      expect(methodExamples[1].result).toBe(base.examples[1].result);

      // First is a function call -> converted to new instance
      expect(methodExamples[0]).not.toBe(base.examples[0]);
      expect(methodExamples[0]).toBeInstanceOf(RoutineExample);
      expect(methodExamples[0].formula).toBe('"hello".format()');
      expect(methodExamples[0].result).toBe(base.examples[0].result);
      expect(methodExamples[0].result!()).toBeFormulaDataType(FormulaNumber, 10);
    });

    it.each([
      { offsets: [0, 5], expected: [0, 5], part: 'the subject' },
      { offsets: [6, 10], expected: [6, 14], part: 'the method name' },
      { offsets: [11, 12], expected: [15, 16], part: 'an argument' },
    ] as const)('should move method offsets over $part to a longer method name', ({ offsets, expected }) => {
      const examples = new RoutineExamples('textSize', [
        {
          formula: (name) => name('"abc"', '1'),
          error: { type: { is: () => true }, message: 'Wrong.', location: { method: offsets } },
        },
      ]);

      const [methodExample] = examples.toMethodExamples('size');

      expect(methodExample.formula).toBe('"abc".textSize(1)');
      expect(methodExample.error?.location.method).toEqual(expected);
    });
  });
});
