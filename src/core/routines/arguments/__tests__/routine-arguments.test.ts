import { Kind } from '~/core/data-types';

import { Argument } from '../argument';
import { CallbackArgument } from '../callback-argument';
import { RoutineArguments } from '../routine-arguments';

describe('RoutineArguments', () => {
  describe('initialization', () => {
    it('should initialize with provided alternatives', () => {
      const dateArg = new Argument(Kind.Date);
      const durationArg = new Argument(Kind.Duration);
      const numberArg = new Argument(Kind.Number);
      const alternatives = [[dateArg, durationArg], [dateArg, numberArg]];
      const args = new RoutineArguments(alternatives);

      expect(args.alternatives).toEqual(alternatives);
    });
  });

  describe('toMethodArgs', () => {
    describe('when alternatives is empty or undefined', () => {
      it('should return empty array when alternatives is empty', () => {
        const args = new RoutineArguments([]);
        const result = args.toMethodArgs();

        expect(result).toEqual([]);
      });
    });

    describe('when first alternative is CallbackArgument', () => {
      it('should return original alternatives', () => {
        const callbackArg = new CallbackArgument(['item']);
        const alternatives = [callbackArg];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toBe(alternatives);
      });
    });

    describe('when first alternative is single Argument', () => {
      it('should return empty array after consuming single non-repeatable argument', () => {
        const numberArg = new Argument(Kind.Number);
        const alternatives = [numberArg];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toEqual([]);
      });

      it('should return slice(1) for two non-repeatable arguments', () => {
        const stringArg = new Argument(Kind.String);
        const numberArg = new Argument(Kind.Number);
        const alternatives = [stringArg, numberArg];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toEqual([numberArg]);
      });

      it('should return original alternatives when argument is repeatable', () => {
        const stringOrNumberRepeatableArg = new Argument([Kind.String, Kind.Number], { repeatable: true });
        const alternatives = [stringOrNumberRepeatableArg];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toBe(alternatives);
      });
    });

    describe('when first alternative is array of Arguments', () => {
      it('should return original alternatives when first element is CallbackArgument', () => {
        const callbackArg = new CallbackArgument(['item']);
        const numberArg = new Argument(Kind.Number);
        const alternatives = [[callbackArg, numberArg]];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toBe(alternatives);
      });

      it('should slice first element when head is non-repeatable (single alternative)', () => {
        const numberArg = new Argument(Kind.Number);
        const stringArg = new Argument(Kind.String);
        const alternatives = [[numberArg, stringArg]];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toEqual([[stringArg]]);
      });

      it('should return slice(1) for single pattern', () => {
        const stringArg = new Argument(Kind.String);
        const numberArg = new Argument(Kind.Number);
        const alternatives = [[stringArg, numberArg]];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toEqual([[numberArg]]);
      });

      it('should handle empty array after slicing first element', () => {
        const stringArg = new Argument(Kind.String);
        const alternatives = [[stringArg]];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toEqual([]);
      });

      it('should return original alternatives when argument is repeatable', () => {
        const stringRepeatableArg = new Argument([Kind.String], { repeatable: true });
        const alternatives = [[stringRepeatableArg]];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toBe(alternatives);
      });
    });

    describe('when alternatives are arrays of Argument', () => {
      it('should return original alternatives when first element is CallbackArgument', () => {
        const callbackArg = new CallbackArgument(['item']);
        const numberArg = new Argument(Kind.Number);
        const stringArg = new Argument(Kind.String);
        const alternatives = [[callbackArg, numberArg], [callbackArg, stringArg]];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toBe(alternatives);
      });

      it('should slice first element across multiple patterns', () => {
        const numberArg = new Argument(Kind.Number);
        const stringArg = new Argument(Kind.String);
        const durationArg = new Argument(Kind.Duration);
        const alternatives = [[numberArg, stringArg], [stringArg, durationArg]];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toEqual([[stringArg], [durationArg]]);
      });

      it('should return slice(1) across multiple patterns', () => {
        const stringArg = new Argument(Kind.String);
        const numberArg = new Argument(Kind.Number);
        const dateArg = new Argument(Kind.Date);
        const alternatives = [[stringArg, numberArg], [stringArg, dateArg]];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toEqual([[numberArg], [dateArg]]);
      });

      it('should handle empty array after slicing first element', () => {
        const stringArg = new Argument(Kind.String);
        const alternatives = [[stringArg], [stringArg]];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toEqual([]);
      });

      it('should return original alternatives when argument is repeatable', () => {
        const stringRepeatableArg = new Argument([Kind.String], { repeatable: true });
        const alternatives = [[stringRepeatableArg], [stringRepeatableArg]];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toBe(alternatives);
      });
    });

    describe('edge cases', () => {
      it('should handle complex nested alternatives structure', () => {
        const stringArg = new Argument(Kind.String);
        const numberArg = new Argument(Kind.Number);
        const dateArg = new Argument(Kind.Date);
        const callbackArg = new CallbackArgument(['item']);

        const alternatives = [
          [stringArg, numberArg],
          [dateArg],
          [callbackArg],
        ];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toEqual([
          [numberArg],
          [],
          [callbackArg],
        ]);
      });

      it('should consume for non-callback, non-repeatable heads in complex case', () => {
        const numberArg = new Argument(Kind.Number);
        const dateArg = new Argument(Kind.Date);
        const booleanArg = new Argument(Kind.Boolean);

        const alternatives = [
          [numberArg, dateArg],
          [booleanArg],
        ];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toEqual([[dateArg], []]);
      });

      it('should handle alternatives with mixed argument and callback patterns correctly', () => {
        const stringArg = new Argument(Kind.String);
        const numberArg = new Argument(Kind.Number);
        const callbackArg = new CallbackArgument(['item']);

        const alternatives = [
          [stringArg, numberArg],
          [callbackArg],
        ];
        const args = new RoutineArguments(alternatives);

        const result = args.toMethodArgs();

        expect(result).toEqual([[numberArg], [callbackArg]]);
      });
    });
  });
});
