import { FormulaNumber } from '../data-types';
import { Expression } from '../expression';

describe(Expression, () => {
  describe('parse', () => {
    it('should parse a valid formula', () => {
      const ast = new Expression('1 + 1').parse();
      expect(ast).toBeDefined();
    });

    it('should throw on invalid formula', () => {
      expect(() => new Expression('1 +').parse()).toThrow();
    });

    it('should cache parsed AST', () => {
      const ast1 = new Expression('1 + 1').parse();
      const ast2 = new Expression('1 + 1').parse();
      expect(ast1).toBe(ast2);
    });
  });

  describe('extractDependencies', () => {
    it('should extract dependencies from a formula', () => {
      const dependencies = new Expression('a + b').extractDependencies();
      expect(dependencies).toEqual(new Set(['a', 'b']));
    });

    it('should throw on invalid formula', () => {
      expect(() => new Expression('1 +').extractDependencies()).toThrow();
    });

    it('should cache parsed AST', () => {
      const dependencies1 = new Expression('a + b').extractDependencies();
      const dependencies2 = new Expression('a + b').extractDependencies();
      expect(dependencies1).toBe(dependencies2);
    });
  });

  describe('evaluate', () => {
    it('should evaluate formula without dependencies', () => {
      const { result: value, dependencies } = new Expression('1 + 1').evaluate();

      expect(value).toBeInstanceOf(FormulaNumber);
      if (value instanceof FormulaNumber) {
        expect(value.value).toBe(2);
      }

      expect(dependencies.size).toBe(0);
    });

    it('should evaluate formula and collect dependencies', () => {
      const { result: value, dependencies } = new Expression('a + b').evaluate({
        context: {
          a: new FormulaNumber(1),
          b: new FormulaNumber(2),
        },
      });

      expect(value).toBeInstanceOf(FormulaNumber);
      if (value instanceof FormulaNumber) {
        expect(value.value).toBe(3);
      }

      expect(dependencies).toEqual(new Set(['a', 'b']));
    });

    describe('conditional Expression', () => {
      it('should collect only active dependencies in truthy conditional expression', () => {
        const { result: value, dependencies } = new Expression('if(flag, a, b)').evaluate({
          context: {
            flag: new FormulaNumber(1),
            a: new FormulaNumber(10),
            b: new FormulaNumber(20),
          },
        },
        );

        expect(value).toBeInstanceOf(FormulaNumber);
        if (value instanceof FormulaNumber) {
          expect(value.value).toBe(10);
        }

        expect(dependencies).toEqual(new Set(['flag', 'a']));
      });

      it('should collect only active dependencies in falsy conditional expression', () => {
        const { result: value, dependencies } = new Expression('if(flag, a, b)').evaluate({
          context: {
            flag: new FormulaNumber(0),
            a: new FormulaNumber(10),
            b: new FormulaNumber(20),
          },
        });

        expect(value).toBeInstanceOf(FormulaNumber);
        if (value instanceof FormulaNumber) {
          expect(value.value).toBe(20);
        }

        expect(dependencies).toEqual(new Set(['flag', 'b']));
      });
    });
  });
});
