import { FormulaArray, FormulaNumber } from '../data-types';
import { Expression, PARSED_TEXTS_CAPACITY, parseFormula } from '../expression';

// Parses as many other texts as the shared cache holds, so a text not used meanwhile is evicted
function parseOtherTexts(): void {
  for (let index = 0; index < PARSED_TEXTS_CAPACITY; index++) {
    parseFormula(`other + ${index}`);
  }
}

describe(parseFormula, () => {
  it('should parse a valid formula', () => {
    const ast = parseFormula('1 + 1');
    expect(ast).toBeDefined();
  });

  it('should throw on invalid formula', () => {
    expect(() => parseFormula('1 +')).toThrow();
  });

  it('should cache parsed AST', () => {
    const ast1 = parseFormula('1 + 1');
    const ast2 = parseFormula('1 + 1');
    expect(ast1).toBe(ast2);
  });

  it('should drop the parse of a text not used while as many other texts were parsed', () => {
    const first = parseFormula('evicted + 1');

    parseOtherTexts();

    expect(parseFormula('evicted + 1')).not.toBe(first);
  });

  it('should keep the parse of a text used again while other texts were parsed', () => {
    const first = parseFormula('kept + 1');

    for (let index = 0; index < PARSED_TEXTS_CAPACITY; index++) {
      parseFormula(`other + ${index}`);
      parseFormula('kept + 1');
    }

    expect(parseFormula('kept + 1')).toBe(first);
  });
});

describe(Expression, () => {
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

    it('should keep the parse of an expression for as long as the expression lives', () => {
      const expression = new Expression('held + 1');
      const first = expression.extractDependencies();

      parseOtherTexts();

      expect(expression.extractDependencies()).toBe(first);
    });

    it.each([
      { formula: 'if(flag, a, b)', expected: ['flag', 'a', 'b'] },
      { formula: 'e() + pi()', expected: [] },
      { formula: 'items.map(current * index)', expected: ['items'] },
      { formula: 'map(items, current * index)', expected: ['items'] },
      { formula: 'items.map(current * price)', expected: ['items', 'price'] },
      { formula: 'filter(items, current > limit)', expected: ['items', 'limit'] },
      { formula: 'current + items.map(current).sum()', expected: ['current', 'items'] },
      { formula: 'groups.map(current.filter(current > index))', expected: ['groups'] },
    ])('should list only context variables for $formula', ({ formula, expected }) => {
      expect(new Expression(formula).extractDependencies()).toEqual(new Set(expected));
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

    describe('callback scope', () => {
      it('should not report callback variables as dependencies', () => {
        const { dependencies } = new Expression('items.map(current * index * price)').evaluate({
          context: {
            items: FormulaArray.from([1, 2]),
            price: new FormulaNumber(3),
          },
        });

        expect(dependencies).toEqual(new Set(['items', 'price']));
      });

      it('should report a context variable named like a callback variable only outside the callback', () => {
        const { dependencies } = new Expression('current + items.map(current).sum()').evaluate({
          context: {
            current: new FormulaNumber(10),
            items: FormulaArray.from([1, 2]),
          },
        });

        expect(dependencies).toEqual(new Set(['current', 'items']));
      });

      it('should not report a context variable shadowed inside the callback', () => {
        const { dependencies } = new Expression('items.map(current).sum()').evaluate({
          context: {
            current: new FormulaNumber(10),
            items: FormulaArray.from([1, 2]),
          },
        });

        expect(dependencies).toEqual(new Set(['items']));
      });
    });
  });
});
