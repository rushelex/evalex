import type { ArgumentsPattern } from '../arguments';

import { FormulaNull, Kind } from '../../data-types';
import { Argument, CallbackArgument } from '../arguments';
import { Routine } from '../routine';

describe(Routine, () => {
  describe('getCallbackVariables', () => {
    it('should return the names a callback at the position introduces', () => {
      const routine = createRoutine([new Argument(Kind.Array), new CallbackArgument(['current', 'index'])]);

      expect(routine.getCallbackVariables(1)).toEqual(['current', 'index']);
    });

    it('should return nothing for a value argument', () => {
      const routine = createRoutine([new Argument(Kind.Array), new CallbackArgument(['current'])]);

      expect(routine.getCallbackVariables(0)).toEqual([]);
    });

    it('should return nothing when another signature takes a value at the position', () => {
      const routine = createRoutine([
        [new Argument(Kind.Array), new CallbackArgument(['current'])],
        [new Argument(Kind.Array), new Argument(Kind.Number)],
      ]);

      expect(routine.getCallbackVariables(1)).toEqual([]);
    });

    it('should return only the names every signature declares at the position', () => {
      const routine = createRoutine([
        [new Argument(Kind.Array), new CallbackArgument(['current', 'index'])],
        [new Argument(Kind.String), new CallbackArgument(['current'])],
      ]);

      expect(routine.getCallbackVariables(1)).toEqual(['current']);
    });

    it('should return nothing for a routine without declared arguments', () => {
      expect(createRoutine(undefined).getCallbackVariables(0)).toEqual([]);
    });
  });
});

// Helpers

function createRoutine(args: ArgumentsPattern | readonly ArgumentsPattern[] | undefined): Routine {
  return new Routine({
    description: 'Test routine.',
    examples: [],
    arguments: args,
    handler: () => FormulaNull.instance(),
  });
}
