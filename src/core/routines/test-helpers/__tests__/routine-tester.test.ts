import { FormulaNumber } from '../../../data-types';
import { routinesRegistry } from '../../registry';
import { ASTBasedFormulaTypeResolver } from '../formula-type-resolver';
import { RoutineTestGenerator } from '../routine-test-generator';
import { RoutineTester } from '../routine-tester';

describe(RoutineTester, () => {
  it('should reject an expected error for a call form the test skips', () => {
    const tester = new RoutineTester('sum');

    expect(() => tester.examples({ skipFunction: true }, [
      { formula: 'sum("a")', expected: { function: { message: 'Expected type Number, or lists of it.', location: [4, 7] } } },
    ])).toThrow('The expected error of "sum("a")" is for a call form this test skips.');
  });
});

describe(RoutineTestGenerator, () => {
  it('should reject a method case whose subject type cannot be determined', () => {
    const generator = new RoutineTestGenerator(routinesRegistry, new ASTBasedFormulaTypeResolver());

    expect(() => generator.forMethodTesting('sum', [{ formula: 'items.sum()', expected: new FormulaNumber(0) }])).toThrow(
      'Cannot determine the subject type of "items.sum()"; pass the subject through `context`.',
    );
  });

  it('should not generate method cases for a routine without a method form', () => {
    const generator = new RoutineTestGenerator(routinesRegistry, new ASTBasedFormulaTypeResolver());

    expect(generator.forMethodTesting('pi', [{ formula: 'pi()', expected: new FormulaNumber(Math.PI) }])).toEqual([]);
  });
});
