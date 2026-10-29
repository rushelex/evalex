import type { FormulaDataType } from '../../data-types';

import { fc, it } from '@fast-check/vitest';

import { evaluate, evaluateOutcome } from '../../../testing-library';
import { ALL_DATA_TYPES, Kind } from '../../data-types';
import { FormulaError } from '../../errors';
import { routinesRegistry } from '../registry';
import { routineCallArbitrary } from '../test-helpers/routine-call-arbitrary';

// Routines that read the clock are deterministic only while it stands still.
vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(Temporal.ZonedDateTime.from('2025-08-02T10:30:00+00:00[UTC]'));

const functions = [...routinesRegistry.getFunctions()].map(([name, routine]) => ({
  name,
  call: routineCallArbitrary({ signatures: routine.signatures }).map((call) => call.asFunction(name)),
}));

const methods = routinesRegistry.getRegisteredDataTypes().flatMap((ctor) => {
  const kind = ALL_DATA_TYPES.find((dataType) => dataType === ctor)?.kind ?? Kind.Any;

  return [...routinesRegistry.getMethods(ctor)].map(([name, routine]) => ({
    label: `${ctor.name}.${name}`,
    kind,
    call: routineCallArbitrary({ signatures: routine.signatures, subjectKind: kind }).map((call) => call.asMethod(name)),
  }));
});

const twins = routinesRegistry.getRegisteredDataTypes().flatMap((ctor) => {
  const kind = ALL_DATA_TYPES.find((dataType) => dataType === ctor)?.kind ?? Kind.Any;

  return [...routinesRegistry.getFunctions()].flatMap(([functionName, routine]) => {
    const methodName = routinesRegistry.getMethodName(functionName);
    const method = methodName === undefined ? undefined : routinesRegistry.getMethod(ctor, methodName);
    // Another routine may own a method of the same name on a type this function does not take as its subject.
    const takesSubject = routine.signatures.some(([subject]) => subject !== undefined && 'kinds' in subject && subject.kinds.some((type) => type === Kind.Any || type === kind));

    if (methodName === undefined || method === undefined || !takesSubject) {
      return [];
    }

    return [{
      label: `${functionName} and ${ctor.name}.${methodName}`,
      functionName,
      methodName,
      call: routineCallArbitrary({ signatures: method.signatures, subjectKind: kind }),
    }];
  });
});

describe('built-in routines', () => {
  describe.each(functions)('$name as function', ({ call }) => {
    it.prop([call])('should fail only with a formula error on any arguments', ({ formula, context }) => {
      try {
        evaluate(formula, { context });
      }
      catch (error) {
        expect(error).toBeInstanceOf(FormulaError);
      }
    });

    it.prop([call, fc.array(call, { maxLength: 4 })])('should return the same outcome whatever calls ran before', (checked, earlierCalls) => {
      const expected = evaluateOutcome(checked.formula, { context: checked.context });

      earlierCalls.forEach(({ formula, context }) => evaluateOutcome(formula, { context }));

      expect(evaluateOutcome(checked.formula, { context: checked.context })).toHaveSameOutcomeAs(expected);
    });

    it.prop([call])('should leave its arguments unchanged', ({ formula, context }) => {
      const before = fingerprint(context);

      evaluateOutcome(formula, { context });

      expect(fingerprint(context)).toEqual(before);
    });
  });

  describe.each(methods)('$label as method', ({ call }) => {
    it.prop([call])('should fail only with a formula error on any subject and arguments', ({ formula, context }) => {
      try {
        evaluate(formula, { context });
      }
      catch (error) {
        expect(error).toBeInstanceOf(FormulaError);
      }
    });

    it.prop([call, fc.array(call, { maxLength: 4 })])('should return the same outcome whatever calls ran before', (checked, earlierCalls) => {
      const expected = evaluateOutcome(checked.formula, { context: checked.context });

      earlierCalls.forEach(({ formula, context }) => evaluateOutcome(formula, { context }));

      expect(evaluateOutcome(checked.formula, { context: checked.context })).toHaveSameOutcomeAs(expected);
    });

    it.prop([call])('should leave its subject and arguments unchanged', ({ formula, context }) => {
      const before = fingerprint(context);

      evaluateOutcome(formula, { context });

      expect(fingerprint(context)).toEqual(before);
    });
  });

  describe.each(twins)('$label', ({ functionName, methodName, call }) => {
    it.prop([call])('should give the same outcome in both forms', (generated) => {
      const asFunction = generated.asFunction(functionName);
      const asMethod = generated.asMethod(methodName);

      expect(evaluateOutcome(asMethod.formula, { context: asMethod.context }))
        .toHaveSameOutcomeAs(evaluateOutcome(asFunction.formula, { context: asFunction.context }));
    });
  });
});

/** Content of every context value, to notice a routine changing a value in place. */
function fingerprint(context: Readonly<Record<string, FormulaDataType>>): Record<string, string> {
  return Object.fromEntries(Object.entries(context).map(([name, value]) => [name, `${value.kind} ${value.toString({ asJSON: true })}`]));
}
