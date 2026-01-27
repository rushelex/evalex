import type { AST } from '../../../../parser';

import { AstNodes } from '../../../../parser';
import { FormulaEvaluationContext } from '../../../context';
import { FormulaString } from '../../../data-types';
import { FormulaEvaluatorVisitor } from '../../../evaluator.visitor';
import { Argument } from '../argument';
import { ArgumentsProcessor } from '../arguments-processor';
import { CallbackArgument } from '../callback-argument';
import { ProcessedArgument } from '../processed-argument';

describe('ArgumentsProcessor', () => {
  const loc = (location: [start: number, end: number]): AST.Location => ({
    start: { line: 0, offset: location[0], column: location[0] + 1 },
    end: { line: 0, offset: location[1], column: location[1] + 1 },
  });

  const literal = (value: string | number | boolean, location: [number, number] = [0, 4]) =>
    new AstNodes.LiteralNode(value, value.toString(), loc(location));

  const identifier = (name: string, location: [number, number] = [0, 4]) =>
    new AstNodes.IdentifierNode(name, loc(location));

  const str = (location: [number, number] = [0, 4]) => literal('test', location);
  const num = (location: [number, number] = [0, 2]) => literal(42, location);
  const bool = (location: [number, number] = [0, 4]) => literal(true, location);
  const arr = (location: [number, number] = [0, 8]) => new AstNodes.ArrayExpressionNode(
    [literal(42, [1, 3]), literal(24, [5, 7])],
    loc(location),
  );

  const createMockVisitor = () => {
    const context = new FormulaEvaluationContext(new Map([
      ['test', new FormulaString('test_value')],
      ['current', new FormulaString('current_value')],
    ]));
    return new FormulaEvaluatorVisitor(context);
  };

  const validateArgs = (processor: ArgumentsProcessor, args: AST.AstNode[]) => {
    const visitor = createMockVisitor();
    const processedArgs = processor.process(args, visitor);
    return processor.validate(processedArgs);
  };

  const getValidationError = (processor: ArgumentsProcessor, args: AST.AstNode[], location = loc([0, 100])) => {
    const visitor = createMockVisitor();
    const processedArgs = processor.process(args, visitor);
    return processor.getValidationError(processedArgs, location);
  };

  const getValidationErrors = (processor: ArgumentsProcessor, args: AST.AstNode[], location = loc([0, 100])) => {
    const visitor = createMockVisitor();
    const processedArgs = processor.process(args, visitor);
    return processor.getValidationErrors(processedArgs, location);
  };

  describe('Core Operations', () => {
    describe('process()', () => {
      it('should create ProcessedArgument for regular arguments', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string', { name: 'text' }),
        ]);
        const visitor = createMockVisitor();

        const result = processor.process([str([5, 9])], visitor);

        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(ProcessedArgument);
        expect((result[0] as ProcessedArgument).dataType.value).toBe('test');
        expect((result[0] as ProcessedArgument).location).toEqual(loc([5, 9]));
      });

      it('should create CallbackExecutor for callback arguments', () => {
        const processor = new ArgumentsProcessor([
          new CallbackArgument(['current'], { name: 'callback' }),
        ]);
        const visitor = createMockVisitor();

        const result = processor.process([identifier('current', [10, 17])], visitor);

        expect(result).toHaveLength(1);
        expect(result[0].constructor.name).toBe('CallbackExecutor');
      });
    });

    describe('validate()', () => {
      it('should validate ProcessedArguments correctly', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string', { name: 'text' }),
        ]);

        expect(validateArgs(processor, [str()])).toBe(true);
        expect(validateArgs(processor, [num()])).toBe(false);
      });
    });

    describe('getValidationError()', () => {
      it('should return error with location for specific argument errors', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string', { name: 'text' }),
        ]);

        const error = getValidationError(processor, [num([9, 11])]);

        expect(error).toBeFormulaError('Expected type string.', [9, 11]);
        expect(error.context).toEqual(expect.objectContaining({
          argumentPosition: 1,
          expected: 'string',
          actual: 'number',
        }));
      });

      it('should return null location for count errors', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string', { name: 'text' }),
        ]);

        const error = getValidationError(processor, [], loc([0, 100]));

        expect(error).toBeFormulaError('Expected at least 1 argument(s).', [0, 100]);
        expect(error.context).toEqual(expect.objectContaining({
          actual: 0,
          expected: [1, 1],
        }));
      });
    });
  });

  describe('Argument Patterns', () => {
    describe('Single Arguments', () => {
      describe('Required Arguments', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string', { name: 'text' }),
        ]);

        it('should validate single required argument', () => {
          expect(validateArgs(processor, [str()])).toBe(true);
          expect(validateArgs(processor, [num()])).toBe(false);
          expect(validateArgs(processor, [])).toBe(false);
          expect(validateArgs(processor, [str(), num()])).toBe(false);
        });

        it('should provide error for wrong type with location', () => {
          const error = getValidationError(processor, [num([5, 7])]);
          expect(error).toBeFormulaError('Expected type string.', [5, 7]);
        });
      });

      describe('Optional Arguments', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string', { optional: true, name: 'text' }),
        ]);

        it('should validate optional argument', () => {
          expect(validateArgs(processor, [])).toBe(true);
          expect(validateArgs(processor, [str()])).toBe(true);
          expect(validateArgs(processor, [num()])).toBe(false);
        });
      });
    });

    describe('Multiple Arguments', () => {
      const processor = new ArgumentsProcessor([
        new Argument('string'),
        new Argument('number', { optional: true }),
        new Argument('boolean', { optional: true }),
      ]);

      it('should validate combinations of required and optional', () => {
        expect(validateArgs(processor, [str()])).toBe(true);
        expect(validateArgs(processor, [str(), num()])).toBe(true);
        expect(validateArgs(processor, [str(), num(), bool()])).toBe(true);
        expect(validateArgs(processor, [])).toBe(false);
        expect(validateArgs(processor, [str(), num(), bool(), str()])).toBe(false);
      });

      it('should provide error for wrong optional type with location', () => {
        const error = getValidationError(processor, [str([0, 4]), str([5, 9])]);
        expect(error).toBeFormulaError('Expected type number.', [5, 9]);
        expect(error.context).toEqual(expect.objectContaining({
          argumentPosition: 2,
          expected: 'number',
          actual: 'string',
        }));
      });
    });

    describe('Repeatable Arguments', () => {
      const processor = new ArgumentsProcessor([
        new Argument('number', { name: 'values', repeatable: true }),
      ]);

      it('should validate repeatable arguments', () => {
        expect(validateArgs(processor, [num()])).toBe(true);
        expect(validateArgs(processor, [num(), num()])).toBe(true);
        expect(validateArgs(processor, [num(), num(), num(), num(), num()])).toBe(true);
        expect(validateArgs(processor, [])).toBe(false);
        expect(validateArgs(processor, [str()])).toBe(false);
        expect(validateArgs(processor, [num(), str()])).toBe(false);
      });

      it('should provide error for wrong repeatable type with location', () => {
        const error = getValidationError(processor, [num(), str([9, 12])]);
        expect(error).toBeFormulaError('Expected type number.', [9, 12]);
        expect(error.context).toEqual(expect.objectContaining({
          argumentPosition: 2,
          expected: 'number',
          actual: 'string',
        }));
      });
    });

    describe('Alternative Patterns', () => {
      const processor = new ArgumentsProcessor([
        // Pattern 1: single array argument
        [new Argument('array', { name: 'numbers_array' })],
        // Pattern 2: repeatable number arguments
        [new Argument('number', { name: 'numbers', repeatable: true })],
      ]);

      it('should validate first pattern (array)', () => {
        expect(validateArgs(processor, [arr()])).toBe(true);
      });

      it('should validate second pattern (repeatable numbers)', () => {
        expect(validateArgs(processor, [num()])).toBe(true);
        expect(validateArgs(processor, [num(), num(), num()])).toBe(true);
      });

      it('should reject invalid arguments', () => {
        expect(validateArgs(processor, [str()])).toBe(false);
        expect(validateArgs(processor, [bool(), num()])).toBe(false);
        expect(validateArgs(processor, [])).toBe(false);
      });

      it('should provide collected error for multiple patterns', () => {
        const error = getValidationError(processor, [str()], loc([0, 100]));
        expect(error).toBeFormulaError('Arguments don\'t match. Pattern 1: Expected type array.; Pattern 2: Expected type number.', [0, 100]);
        expect(error.context).toEqual(expect.objectContaining({
          expected: 'one of 2 patterns',
          actual: 'invalid',
        }));
      });

      it('should provide errors for multiple patterns', () => {
        const errors = getValidationErrors(processor, [str()], loc([0, 100]));
        // "Arguments don't match. Pattern 1: Expected type array. [0,4]; Pattern 2: Expected type number. [0,4]."
        expect(errors).toHaveLength(2);
        expect(errors[0]).toBeFormulaError('Expected type array.', [0, 4]);
        expect(errors[0].context).toEqual(expect.objectContaining({
          argumentPosition: 1,
          expected: 'array',
          actual: 'string',
        }));
        expect(errors[1]).toBeFormulaError('Expected type number.', [0, 4]);
        expect(errors[1].context).toEqual(expect.objectContaining({
          argumentPosition: 1,
          expected: 'number',
          actual: 'string',
        }));
      });
    });
  });

  describe('Data Types', () => {
    describe('Basic Types', () => {
      it('should validate string type', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string'),
        ]);

        expect(validateArgs(processor, [str()])).toBe(true);
        expect(validateArgs(processor, [num()])).toBe(false);
      });

      it('should validate number type', () => {
        const processor = new ArgumentsProcessor([
          new Argument('number'),
        ]);

        expect(validateArgs(processor, [num()])).toBe(true);
        expect(validateArgs(processor, [str()])).toBe(false);
      });

      it('should validate boolean type', () => {
        const processor = new ArgumentsProcessor([
          new Argument('boolean'),
        ]);

        expect(validateArgs(processor, [bool()])).toBe(true);
        expect(validateArgs(processor, [str()])).toBe(false);
      });

      it('should validate array type', () => {
        const processor = new ArgumentsProcessor([
          new Argument('array'),
        ]);

        expect(validateArgs(processor, [arr()])).toBe(true);
        expect(validateArgs(processor, [str()])).toBe(false);
      });
    });

    describe('Union Types', () => {
      const processor = new ArgumentsProcessor([
        new Argument(['string', 'number'], { name: 'value' }),
      ]);

      it('should validate union types', () => {
        expect(validateArgs(processor, [str()])).toBe(true);
        expect(validateArgs(processor, [num()])).toBe(true);
        expect(validateArgs(processor, [bool()])).toBe(false);
      });

      it('should provide error for wrong union type with location', () => {
        const error = getValidationError(processor, [bool([5, 9])]);
        expect(error).toBeFormulaError('Expected type string | number.', [5, 9]);
        expect(error.context).toEqual(expect.objectContaining({
          argumentPosition: 1,
          expected: ['string', 'number'],
          actual: 'boolean',
        }));
      });
    });

    describe('Any Type', () => {
      const processor = new ArgumentsProcessor([
        new Argument('any'),
        new Argument(['any', 'string']),
      ]);

      it('should accept any type for Any arguments', () => {
        expect(validateArgs(processor, [str(), str()])).toBe(true);
        expect(validateArgs(processor, [num(), str()])).toBe(true);
        expect(validateArgs(processor, [bool(), arr()])).toBe(true);
        expect(validateArgs(processor, [arr(), num()])).toBe(true);
        expect(validateArgs(processor, [str(), bool()])).toBe(true);
        expect(validateArgs(processor, [num(), num()])).toBe(true);
      });
    });
  });

  describe('Callback Arguments', () => {
    describe('CallbackArgument Processing', () => {
      it('should create CallbackExecutor for callback arguments', () => {
        const processor = new ArgumentsProcessor([
          new CallbackArgument(['current'], { name: 'callback' }),
        ]);
        const visitor = createMockVisitor();

        const result = processor.process([identifier('current')], visitor);

        expect(result).toHaveLength(1);
        expect(result[0].constructor.name).toBe('CallbackExecutor');
      });

      it('should handle callback with return type', () => {
        const processor = new ArgumentsProcessor([
          new CallbackArgument(['current'], {
            name: 'callback',
            returnType: 'number',
          }),
        ]);
        const visitor = createMockVisitor();

        const result = processor.process([identifier('current')], visitor);

        expect(result).toHaveLength(1);
        expect(result[0].constructor.name).toBe('CallbackExecutor');
      });

      it('should handle optional callback arguments', () => {
        const processor = new ArgumentsProcessor([
          new CallbackArgument(['current'], {
            name: 'callback',
            optional: true,
          }),
        ]);

        expect(validateArgs(processor, [])).toBe(true);
        expect(validateArgs(processor, [identifier('current')])).toBe(true);
      });
    });

    describe('CallbackArgument Validation', () => {
      const processor = new ArgumentsProcessor([
        new CallbackArgument(['current'], { name: 'callback' }),
      ]);

      it('should validate callback arguments', () => {
        // CallbackArgument accepts ANY AST node and wraps it in CallbackExecutor
        expect(validateArgs(processor, [identifier('current')])).toBe(true);
        expect(validateArgs(processor, [str()])).toBe(true); // Any AST node is valid for callback
        expect(validateArgs(processor, [num()])).toBe(true); // Any AST node is valid for callback
        expect(validateArgs(processor, [bool()])).toBe(true); // Any AST node is valid for callback
      });

      it('should reject wrong argument count', () => {
        expect(validateArgs(processor, [])).toBe(false); // Missing required callback
        expect(validateArgs(processor, [str(), num()])).toBe(false); // Too many arguments
      });
    });

    describe('Mixed Callback and Regular Arguments', () => {
      const processor = new ArgumentsProcessor([
        new Argument('array', { name: 'array' }),
        new CallbackArgument(['current'], { name: 'callback' }),
      ]);

      it('should validate mixed arguments', () => {
        expect(validateArgs(processor, [arr(), identifier('current')])).toBe(true);
        expect(validateArgs(processor, [arr(), str()])).toBe(true); // Any AST node is valid for callback
        expect(validateArgs(processor, [str(), identifier('current')])).toBe(false); // Wrong type for first arg
      });

      it('should provide specific error for wrong regular argument position', () => {
        const error = getValidationError(processor, [str([0, 4]), identifier('current')]);
        expect(error).toBeFormulaError('Expected type array.', [0, 4]);
        expect(error.context).toEqual(expect.objectContaining({
          argumentPosition: 1,
          expected: 'array',
          actual: 'string',
        }));
      });

      it('should validate argument count', () => {
        expect(validateArgs(processor, [])).toBe(false); // Missing required arguments
        expect(validateArgs(processor, [arr()])).toBe(false); // Missing callback argument
        expect(validateArgs(processor, [arr(), str(), num()])).toBe(false); // Too many arguments
      });
    });
  });

  describe('Custom Validation', () => {
    it('should validate arguments using custom validator', () => {
      const processor = new ArgumentsProcessor([
        new Argument('string', {
          name: 'text',
          validation: (dataType) => dataType.value === 'test' ? undefined : 'Invalid value',
        }),
      ]);

      expect(validateArgs(processor, [str([5, 9])])).toBe(true);
      expect(validateArgs(processor, [num([5, 9])])).toBe(false);
    });

    it('should return custom validation error message', () => {
      const processor = new ArgumentsProcessor([
        new Argument('string', {
          name: 'text',
          validation: (dataType) => dataType.value === 'invalid' ? `Expected "test", but got "${dataType.value}".` : undefined,
        }),
      ]);

      const invalidStr = (location: [number, number] = [0, 4]) => literal('invalid', location);

      const error = getValidationError(processor, [invalidStr([5, 9])]);

      expect(error).toBeFormulaError('Expected "test", but got "invalid".', [5, 9]);
      expect(error.context).toEqual(expect.objectContaining({
        argumentPosition: 1,
        actual: 'invalid',
        expected: 'unknown',
      }));
    });

    describe('String Literals', () => {
      const processor = new ArgumentsProcessor([
        new Argument('string', {
          name: 'unit',
          validation: (dataType) => {
            if (!['years', 'months', 'days'].includes(dataType.value)) {
              return `Expected "years", "months", "days", but got "${dataType.value}".`;
            }
          },
        }),
      ]);

      it('should validate allowed string literals', () => {
        expect(validateArgs(processor, [literal('years')])).toBe(true);
        expect(validateArgs(processor, [literal('months')])).toBe(true);
        expect(validateArgs(processor, [literal('days')])).toBe(true);
      });

      it('should reject invalid string literals', () => {
        expect(validateArgs(processor, [literal('invalid')])).toBe(false);
        expect(validateArgs(processor, [literal('hours')])).toBe(false);
      });

      it('should provide proper error message for invalid string literal with location', () => {
        const error = getValidationError(processor, [literal('invalid', [10, 17])]);

        expect(error).toBeFormulaError('Expected "years", "months", "days", but got "invalid".', [10, 17]);
        expect(error.context).toEqual(expect.objectContaining({
          argumentPosition: 1,
          actual: 'invalid',
          expected: 'unknown',
        }));
      });
    });

    describe('Number Literals', () => {
      const processor = new ArgumentsProcessor([
        new Argument('number', {
          name: 'level',
          validation: (dataType) => {
            if (![1, 2, 3].includes(dataType.value)) {
              return `Expected "1", "2", "3", but got "${dataType.value}".`;
            }
          },
        }),
      ]);

      it('should validate allowed number literals', () => {
        expect(validateArgs(processor, [literal(1)])).toBe(true);
        expect(validateArgs(processor, [literal(2)])).toBe(true);
        expect(validateArgs(processor, [literal(3)])).toBe(true);
      });

      it('should reject invalid number literals', () => {
        expect(validateArgs(processor, [literal(4)])).toBe(false);
        expect(validateArgs(processor, [literal(0)])).toBe(false);
      });

      it('should provide proper error message for invalid number literal with location', () => {
        const error = getValidationError(processor, [literal(4, [10, 11])]);

        expect(error).toBeFormulaError('Expected "1", "2", "3", but got "4".', [10, 11]);
        expect(error.context).toEqual(expect.objectContaining({
          argumentPosition: 1,
          actual: '4',
          expected: 'unknown',
        }));
      });
    });

    describe('Boolean Literals', () => {
      const processor = new ArgumentsProcessor([
        new Argument('boolean', {
          name: 'flag',
          validation: (dataType) => {
            if (dataType.value !== true) {
              return 'Expected "true", but got "false".';
            }
          },
        }),
      ]);

      it('should validate allowed boolean literals', () => {
        expect(validateArgs(processor, [literal(true)])).toBe(true);
      });

      it('should reject invalid boolean literals', () => {
        expect(validateArgs(processor, [literal(false)])).toBe(false);
      });
    });

    describe('Mixed Literals', () => {
      const processor = new ArgumentsProcessor([
        new Argument('number', { name: 'amount' }),
        new Argument('string', {
          name: 'unit',
          validation: (dataType) => {
            if (!['hours', 'minutes', 'seconds'].includes(dataType.value)) {
              return `Expected "hours", "minutes", "seconds", but got "${dataType.value}".`;
            }
          },
        }),
      ]);

      it('should validate correct type and literal combination', () => {
        expect(validateArgs(processor, [literal(5), literal('hours')])).toBe(true);
        expect(validateArgs(processor, [literal(10), literal('minutes')])).toBe(true);
        expect(validateArgs(processor, [literal(30), literal('seconds')])).toBe(true);
      });

      it('should reject invalid type', () => {
        expect(validateArgs(processor, [literal('5'), literal('hours')])).toBe(false);
      });

      it('should reject invalid literal', () => {
        expect(validateArgs(processor, [literal(5), literal('invalid')])).toBe(false);
      });

      it('should prioritize literal error over pattern mismatch when types match', () => {
        const multiPatternProcessor = new ArgumentsProcessor([
          // Pattern 1: Number and string with specific literals
          [
            new Argument('number', { name: 'amount' }),
            new Argument('string', {
              name: 'unit',
              validation: (dataType) => {
                if (!['hours', 'minutes', 'seconds'].includes(dataType.value)) {
                  return 'Expected "hours", "minutes", "seconds".';
                }
              },
            }),
          ],
          // Pattern 2: Just a string
          [new Argument('string', { name: 'text' })],
        ]);

        const error = getValidationError(multiPatternProcessor, [
          literal(5),
          literal('minute', [10, 16]), // Wrong literal (should be 'minutes')
        ]);

        expect(error).toBeFormulaError('Expected "hours", "minutes", "seconds".', [10, 16]);
        expect(error.context).toEqual(expect.objectContaining({
          argumentPosition: 2,
        }));
      });
    });
  });

  describe('Error Handling', () => {
    describe('Location Tracking', () => {
      it('should track location for type errors', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string'),
        ]);

        const error = getValidationError(processor, [num([15, 17])]);
        expect(error).toBeFormulaError('Expected type string.', [15, 17]);
      });

      it('should track location for custom validation errors', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string', { validation: (dataType) => dataType.value === 'valid' ? undefined : 'Invalid value.' }),
        ]);

        const error = getValidationError(processor, [literal('invalid', [20, 27])]);
        expect(error).toBeFormulaError('Invalid value.', [20, 27]);
      });

      it('should return null location for count errors', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string'),
        ]);

        const error = getValidationError(processor, [], loc([0, 100]));

        expect(error).toBeFormulaError('Expected at least 1 argument(s).', [0, 100]);
      });

      it('should return fallback location for pattern mismatch errors', () => {
        const processor = new ArgumentsProcessor([
          [new Argument('array')],
          [new Argument('number', { repeatable: true })],
        ]);

        const error = getValidationError(processor, [str()], loc([0, 100]));

        expect(error.location).toEqual(loc([0, 100]));
      });
    });

    describe('Error Messages', () => {
      it('should provide clear type error messages', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string'),
        ]);

        const error = getValidationError(processor, [num()]);

        expect(error).toBeFormulaError('Expected type string.', [0, 2]);
      });

      it('should provide clear custom validation error messages', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string', { validation: (dataType) => dataType.value === 'valid' ? undefined : 'Invalid value.' }),
        ]);

        const error = getValidationError(processor, [literal('invalid')]);

        expect(error).toBeFormulaError('Invalid value.', [0, 4]);
      });

      it('should provide clear count error messages', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string'),
          new Argument('number'),
        ]);

        const error = getValidationError(processor, [str()]);

        expect(error).toBeFormulaError('Expected at least 2 argument(s).', [0, 100]);
      });
    });

    describe('Error Context', () => {
      it('should provide argument position in context', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string'),
          new Argument('number'),
        ]);

        const error = getValidationError(processor, [str(), str()]);

        expect(error.context).toEqual(expect.objectContaining({
          argumentPosition: 2,
        }));
      });

      it('should provide expected and actual types in context', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string'),
        ]);

        const error = getValidationError(processor, [num()]);

        expect(error.context).toEqual(expect.objectContaining({
          expected: 'string',
          actual: 'number',
        }));
      });

      it('should provide expected and actual arguments count in context', () => {
        const processor = new ArgumentsProcessor([
          new Argument('string'),
        ]);

        const error = getValidationError(processor, []);

        expect(error.context).toEqual(expect.objectContaining({
          expected: [1, 1],
          actual: 0,
        }));
      });
    });
  });

  describe('Edge Cases', () => {
    describe('Empty Patterns', () => {
      it('should handle empty pattern', () => {
        const processor = new ArgumentsProcessor([]);

        expect(validateArgs(processor, [])).toBe(true);
        expect(validateArgs(processor, [str()])).toBe(false);
      });
    });

    describe('All Optional Arguments', () => {
      const processor = new ArgumentsProcessor([
        new Argument('string', { optional: true }),
        new Argument('number', { optional: true }),
      ]);

      it('should handle all optional arguments', () => {
        expect(validateArgs(processor, [])).toBe(true);
        expect(validateArgs(processor, [str()])).toBe(true);
        expect(validateArgs(processor, [str(), num()])).toBe(true);
      });
    });

    describe('Complex Scenarios', () => {
      const processor = new ArgumentsProcessor([
        new Argument('string', { name: 'separator' }),
        new Argument('boolean', { optional: true, name: 'caseSensitive' }),
        new Argument('string', { name: 'values', optional: true, repeatable: true }),
      ]);

      it('should validate complex pattern combinations', () => {
        expect(validateArgs(processor, [str()])).toBe(true); // only required
        expect(validateArgs(processor, [str(), bool()])).toBe(true); // required + optional
        expect(validateArgs(processor, [str(), bool(), str()])).toBe(true); // required + optional + optional repeatable
        expect(validateArgs(processor, [str(), bool(), str(), str(), str()])).toBe(true); // required + optional + multiple optional repeatable
        expect(validateArgs(processor, [])).toBe(false); // missing required
      });
    });
  });
});
