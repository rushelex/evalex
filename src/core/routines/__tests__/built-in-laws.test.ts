import { it } from '@fast-check/vitest';

import { evaluate } from '../../../testing-library';
import { ALL_DATA_TYPES, Kind } from '../../data-types';
import { FormulaError } from '../../errors';
import { routinesRegistry } from '../registry';
import { routineCallArbitrary } from '../test-helpers/routine-call-arbitrary';

const functions = [...routinesRegistry.getFunctions()].map(([name, routine]) => ({ name, routine }));

const methods = routinesRegistry.getRegisteredDataTypes().flatMap((ctor) => {
  const kind = ALL_DATA_TYPES.find((dataType) => dataType === ctor)?.kind ?? Kind.Any;

  return [...routinesRegistry.getMethods(ctor)].map(([name, routine]) => ({ name, routine, kind, label: `${ctor.name}.${name}` }));
});

describe('built-in routines', () => {
  describe.each(functions)('$name as function', ({ name, routine }) => {
    it.prop([routineCallArbitrary({ name, routine, form: 'function' })])('should fail only with a formula error on any arguments', ({ formula, context }) => {
      try {
        evaluate(formula, { context });
      }
      catch (error) {
        expect(error).toBeInstanceOf(FormulaError);
      }
    });
  });

  describe.each(methods)('$label as method', ({ name, routine, kind }) => {
    it.prop([routineCallArbitrary({ name, routine, form: 'method', subjectKind: kind })])('should fail only with a formula error on any subject and arguments', ({ formula, context }) => {
      try {
        evaluate(formula, { context });
      }
      catch (error) {
        expect(error).toBeInstanceOf(FormulaError);
      }
    });
  });
});
