import type { AST } from '../../../../parser';

import { AstNodes } from '../../../../parser';

import { FormulaEvaluationContext } from '../../../context';
import { FormulaString, Kind } from '../../../data-types';
import { Errors } from '../../../errors';
import { FormulaEvaluatorVisitor } from '../../../evaluator.visitor';
import { Argument } from '../argument';
import { ArgumentsProcessor } from '../arguments-processor';
import { CallbackArgument } from '../callback-argument';
import { ProcessedArgument } from '../processed-argument';

describe(ArgumentsProcessor, () => {
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
    return new FormulaEvaluatorVisitor('test_formula', context);
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
          new Argument(Kind.String, { name: 'text' }),
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
          new Argument(Kind.String, { name: 'text' }),
        ]);

        expect(validateArgs(processor, [str()])).toBe(true);
        expect(validateArgs(processor, [num()])).toBe(false);
      });
    });

    describe('getValidationError()', () => {
      it('should return error with location for specific argument errors', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { name: 'text' }),
        ]);

        const error = getValidationError(processor, [num([9, 11])]);

        expect(error).toEqual(Errors.Argument.TypeMismatch.create({
          argumentPosition: 1,
          expected: [Kind.String],
          actual: Kind.Number,
        }, {
          location: loc([9, 11]),
        }));
      });

      it('should return null location for count errors', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { name: 'text' }),
        ]);

        const error = getValidationError(processor, [], loc([0, 100]));

        expect(error).toEqual(Errors.Argument.TooFew.create({
          expectedMin: 1,
          expectedMax: 1,
          actual: 0,
        }, {
          location: loc([0, 100]),
        }));
      });
    });
  });

  describe('Argument Patterns', () => {
    describe('Single Arguments', () => {
      describe('Required Arguments', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { name: 'text' }),
        ]);

        it('should validate single required argument', () => {
          expect(validateArgs(processor, [str()])).toBe(true);
          expect(validateArgs(processor, [num()])).toBe(false);
          expect(validateArgs(processor, [])).toBe(false);
          expect(validateArgs(processor, [str(), num()])).toBe(false);
        });

        it('should provide error for wrong type with location', () => {
          const error = getValidationError(processor, [num([5, 7])]);
          expect(error).toEqual(Errors.Argument.TypeMismatch.create({
            argumentPosition: 1,
            expected: [Kind.String],
            actual: Kind.Number,
          }, {
            location: loc([5, 7]),
          }));
        });
      });

      describe('Optional Arguments', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { optional: true, name: 'text' }),
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
        new Argument(Kind.String, { name: 'text' }),
        new Argument(Kind.Number, { name: 'value', optional: true }),
        new Argument(Kind.Boolean, { name: 'value', optional: true }),
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
        expect(error).toEqual(Errors.Argument.TypeMismatch.create({
          argumentPosition: 2,
          expected: [Kind.Number],
          actual: Kind.String,
        }, {
          location: loc([5, 9]),
        }));
      });
    });

    describe('Repeatable Arguments', () => {
      const processor = new ArgumentsProcessor([
        new Argument(Kind.Number, { name: 'values', repeatable: true }),
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
        expect(error).toEqual(Errors.Argument.TypeMismatch.create({
          argumentPosition: 2,
          expected: [Kind.Number],
          actual: Kind.String,
        }, {
          location: loc([9, 12]),
        }));
      });
    });

    describe('Alternative Patterns', () => {
      const processor = new ArgumentsProcessor([
        // Pattern 1: single array argument
        [new Argument(Kind.Array, { name: 'numbers_array' })],
        // Pattern 2: repeatable number arguments
        [new Argument(Kind.Number, { name: 'numbers', repeatable: true })],
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
        expect(error).toEqual(Errors.Argument.PatternMismatch.create(
          {
            patterns: [
              { patternIndex: 0, message: 'Expected type Array.', location: loc([0, 4]) },
              { patternIndex: 1, message: 'Expected type Number.', location: loc([0, 4]) },
            ],
          },
          {
            location: loc([0, 100]),
          },
        ));
      });

      it('should provide errors for multiple patterns', () => {
        const errors = getValidationErrors(processor, [str()], loc([0, 100]));
        expect(errors).toHaveLength(2);
        expect(errors[0]).toEqual(Errors.Argument.TypeMismatch.create({
          argumentPosition: 1,
          expected: [Kind.Array],
          actual: Kind.String,
        }, {
          location: loc([0, 4]),
        }));
        expect(errors[1]).toEqual(Errors.Argument.TypeMismatch.create({
          argumentPosition: 1,
          expected: [Kind.Number],
          actual: Kind.String,
        }, {
          location: loc([0, 4]),
        }));
      });
    });
  });

  describe('Data Types', () => {
    describe('Basic Types', () => {
      it('should validate string type', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { name: 'text' }),
        ]);

        expect(validateArgs(processor, [str()])).toBe(true);
        expect(validateArgs(processor, [num()])).toBe(false);
      });

      it('should validate number type', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.Number, { name: 'number' }),
        ]);

        expect(validateArgs(processor, [num()])).toBe(true);
        expect(validateArgs(processor, [str()])).toBe(false);
      });

      it('should validate boolean type', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.Boolean, { name: 'flag' }),
        ]);

        expect(validateArgs(processor, [bool()])).toBe(true);
        expect(validateArgs(processor, [str()])).toBe(false);
      });

      it('should validate array type', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.Array, { name: 'list' }),
        ]);

        expect(validateArgs(processor, [arr()])).toBe(true);
        expect(validateArgs(processor, [str()])).toBe(false);
      });
    });

    describe('Union Types', () => {
      const processor = new ArgumentsProcessor([
        new Argument([Kind.String, Kind.Number], { name: 'value' }),
      ]);

      it('should validate union types', () => {
        expect(validateArgs(processor, [str()])).toBe(true);
        expect(validateArgs(processor, [num()])).toBe(true);
        expect(validateArgs(processor, [bool()])).toBe(false);
      });

      it('should provide error for wrong union type with location', () => {
        const error = getValidationError(processor, [bool([5, 9])]);
        expect(error).toEqual(Errors.Argument.TypeMismatch.create({
          argumentPosition: 1,
          expected: [Kind.String, Kind.Number],
          actual: Kind.Boolean,
        }, {
          location: loc([5, 9]),
        }));
      });
    });

    describe('Any Type', () => {
      const processor = new ArgumentsProcessor([
        new Argument(Kind.Any, { name: 'value' }),
        new Argument([Kind.Any, Kind.String], { name: 'value' }),
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
            returnType: Kind.Number,
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
        new Argument(Kind.Array, { name: 'array' }),
        new CallbackArgument(['current'], { name: 'callback' }),
      ]);

      it('should validate mixed arguments', () => {
        expect(validateArgs(processor, [arr(), identifier('current')])).toBe(true);
        expect(validateArgs(processor, [arr(), str()])).toBe(true); // Any AST node is valid for callback
        expect(validateArgs(processor, [str(), identifier('current')])).toBe(false); // Wrong type for first arg
      });

      it('should provide specific error for wrong regular argument position', () => {
        const error = getValidationError(processor, [str([0, 4]), identifier('current')]);
        expect(error).toEqual(Errors.Argument.TypeMismatch.create({
          argumentPosition: 1,
          expected: [Kind.Array],
          actual: Kind.String,
        }, {
          location: loc([0, 4]),
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
        new Argument(Kind.String, {
          name: 'text',
          validation: (dataType) => dataType.value === 'test' ? undefined : { message: 'Invalid value' },
        }),
      ]);

      expect(validateArgs(processor, [str([5, 9])])).toBe(true);
      expect(validateArgs(processor, [num([5, 9])])).toBe(false);
    });

    it('should return custom validation error message', () => {
      const processor = new ArgumentsProcessor([
        new Argument(Kind.String, {
          name: 'text',
          validation: (dataType) => dataType.value === 'invalid'
            ? {
                message: `Expected "test", but got "${dataType.value}".`,
                actual: dataType.value,
                expected: ['test'],
                argumentPosition: 1,
              }
            : undefined,
        }),
      ]);

      const invalidStr = (location: [number, number] = [0, 4]) => literal('invalid', location);

      const error = getValidationError(processor, [invalidStr([5, 9])]);

      expect(error).toEqual(Errors.Argument.Validation.create({
        argumentPosition: 1,
        actual: 'invalid',
        expected: ['test'],
        message: 'Expected "test", but got "invalid".',
      }, {
        location: loc([5, 9]),
      }));
    });

    describe('String Literals', () => {
      const processor = new ArgumentsProcessor([
        new Argument(Kind.String, {
          name: 'unit',
          validation: (dataType) => {
            if (!['years', 'months', 'days'].includes(dataType.value)) {
              return {
                message: `Expected "years", "months", "days", but got "${dataType.value}".`,
                actual: dataType.value,
                expected: ['years', 'months', 'days'],
                argumentPosition: 1,
              };
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

        expect(error).toEqual(Errors.Argument.Validation.create({
          argumentPosition: 1,
          actual: 'invalid',
          expected: ['years', 'months', 'days'],
          message: 'Expected "years", "months", "days", but got "invalid".',
        }, {
          location: loc([10, 17]),
        }));
      });
    });

    describe('Number Literals', () => {
      const processor = new ArgumentsProcessor([
        new Argument(Kind.Number, {
          name: 'level',
          validation: (dataType) => {
            if (![1, 2, 3].includes(dataType.value)) {
              return {
                message: `Expected "1", "2", "3", but got "${dataType.value}".`,
                actual: dataType.value,
                expected: [1, 2, 3],
                argumentPosition: 1,
              };
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

        expect(error).toEqual(Errors.Argument.Validation.create({
          argumentPosition: 1,
          actual: 4,
          expected: [1, 2, 3],
          message: 'Expected "1", "2", "3", but got "4".',
        }, {
          location: loc([10, 11]),
        }));
      });
    });

    describe('Boolean Literals', () => {
      const processor = new ArgumentsProcessor([
        new Argument(Kind.Boolean, {
          name: 'flag',
          validation: (dataType) => {
            if (dataType.value !== true) {
              return {
                message: 'Expected "true", but got "false".',
                actual: dataType.value,
                expected: [true],
                argumentPosition: 1,
              };
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
        new Argument(Kind.Number, { name: 'amount' }),
        new Argument(Kind.String, {
          name: 'unit',
          validation: (dataType) => {
            if (!['hours', 'minutes', 'seconds'].includes(dataType.value)) {
              return {
                message: `Expected "hours", "minutes", "seconds", but got "${dataType.value}".`,
                actual: dataType.value,
                expected: ['hours', 'minutes', 'seconds'],
                argumentPosition: 2,
              };
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
            new Argument(Kind.Number, { name: 'amount' }),
            new Argument(Kind.String, {
              name: 'unit',
              validation: (dataType) => {
                if (!['hours', 'minutes', 'seconds'].includes(dataType.value)) {
                  return {
                    message: `Expected "hours", "minutes", "seconds", but got "${dataType.value}".`,
                    actual: dataType.value,
                    expected: ['hours', 'minutes', 'seconds'],
                    argumentPosition: 2,
                  };
                }
              },
            }),
          ],
          // Pattern 2: Just a string
          [new Argument(Kind.String, { name: 'text' })],
        ]);

        const error = getValidationError(multiPatternProcessor, [
          literal(5),
          literal('minute', [10, 16]), // Wrong literal (should be 'minutes')
        ]);

        expect(error).toEqual(Errors.Argument.Validation.create({
          argumentPosition: 2,
          actual: 'minute',
          expected: ['hours', 'minutes', 'seconds'],
          message: 'Expected "hours", "minutes", "seconds", but got "minute".',
        }, {
          location: loc([10, 16]),
        }));
      });
    });
  });

  describe('Error Handling', () => {
    describe('Location Tracking', () => {
      it('should track location for type errors', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { name: 'text' }),
        ]);

        const error = getValidationError(processor, [num([15, 17])]);
        expect(error).toEqual(Errors.Argument.TypeMismatch.create({
          argumentPosition: 1,
          expected: [Kind.String],
          actual: Kind.Number,
        }, {
          location: loc([15, 17]),
        }));
      });

      it('should track location for custom validation errors', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, {
            name: 'text',
            validation: (dataType) => dataType.value === 'valid'
              ? undefined
              : {
                  message: 'Invalid value.',
                  actual: dataType.value,
                  expected: ['valid value'],
                  argumentPosition: 1,
                },
          }),
        ]);

        const error = getValidationError(processor, [literal('invalid', [20, 27])]);
        expect(error).toEqual(Errors.Argument.Validation.create({
          argumentPosition: 1,
          expected: ['valid value'],
          actual: 'invalid',
          message: 'Invalid value.',
        }, {
          location: loc([20, 27]),
        }));
      });

      it('should return null location for count errors', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { name: 'text' }),
        ]);

        const error = getValidationError(processor, [], loc([0, 100]));

        expect(error).toEqual(Errors.Argument.TooFew.create({
          expectedMin: 1,
          expectedMax: 1,
          actual: 0,
        }, {
          location: loc([0, 100]),
        }));
      });

      it('should return fallback location for pattern mismatch errors', () => {
        const processor = new ArgumentsProcessor([
          [new Argument(Kind.Array, { name: 'list' })],
          [new Argument(Kind.Number, { name: 'numbers', repeatable: true })],
        ]);

        const error = getValidationError(processor, [str()], loc([0, 100]));

        expect(error.location).toEqual(loc([0, 100]));
      });
    });

    describe('Error Messages', () => {
      it('should provide clear type error messages', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { name: 'text' }),
        ]);

        const error = getValidationError(processor, [num()]);

        expect(error).toEqual(Errors.Argument.TypeMismatch.create({
          argumentPosition: 1,
          expected: [Kind.String],
          actual: Kind.Number,
        }, {
          location: loc([0, 2]),
        }));
      });

      it('should provide clear custom validation error messages', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, {
            name: 'text',
            validation: (dataType) => dataType.value === 'valid'
              ? undefined
              : {
                  message: 'Invalid value.',
                  actual: dataType.value,
                  expected: ['valid value'],
                  argumentPosition: 1,
                },
          }),
        ]);

        const error = getValidationError(processor, [literal('invalid')]);

        expect(error).toEqual(Errors.Argument.Validation.create({
          argumentPosition: 1,
          expected: ['valid value'],
          actual: 'invalid',
          message: 'Invalid value.',
        }, {
          location: loc([0, 4]),
        }));
      });

      it('should provide clear count error messages', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { name: 'text' }),
          new Argument(Kind.Number, { name: 'number' }),
        ]);

        const error = getValidationError(processor, [str()]);

        expect(error).toEqual(Errors.Argument.TooFew.create({
          expectedMin: 2,
          expectedMax: 2,
          actual: 1,
        }, {
          location: loc([0, 100]),
        }));
      });
    });

    describe('Error Context', () => {
      it('should provide argument position in payload', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { name: 'text' }),
          new Argument(Kind.Number, { name: 'number' }),
        ]);

        const error = getValidationError(processor, [str(), str([9, 11])]);

        expect(error).toEqual(Errors.Argument.TypeMismatch.create({
          argumentPosition: 2,
          expected: [Kind.Number],
          actual: Kind.String,
        }, {
          location: loc([9, 11]),
        }));
      });

      it('should provide expected and actual types in payload', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { name: 'text' }),
        ]);

        const error = getValidationError(processor, [num([0, 2])]);

        expect(error).toEqual(Errors.Argument.TypeMismatch.create({
          argumentPosition: 1,
          expected: [Kind.String],
          actual: Kind.Number,
        }, {
          location: loc([0, 2]),
        }));
      });

      it('should provide expected and actual arguments count in payload', () => {
        const processor = new ArgumentsProcessor([
          new Argument(Kind.String, { name: 'text' }),
        ]);

        const error = getValidationError(processor, [], loc([0, 100]));

        expect(error).toEqual(Errors.Argument.TooFew.create({
          expectedMin: 1,
          expectedMax: 1,
          actual: 0,
        }, {
          location: loc([0, 100]),
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
        new Argument(Kind.String, { name: 'value', optional: true }),
        new Argument(Kind.Number, { name: 'value', optional: true }),
      ]);

      it('should handle all optional arguments', () => {
        expect(validateArgs(processor, [])).toBe(true);
        expect(validateArgs(processor, [str()])).toBe(true);
        expect(validateArgs(processor, [str(), num()])).toBe(true);
      });
    });

    describe('Complex Scenarios', () => {
      const processor = new ArgumentsProcessor([
        new Argument(Kind.String, { name: 'separator' }),
        new Argument(Kind.Boolean, { optional: true, name: 'caseSensitive' }),
        new Argument(Kind.String, { name: 'values', optional: true, repeatable: true }),
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
