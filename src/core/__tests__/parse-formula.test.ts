import { PARSED_TEXTS_CAPACITY, parseFormula } from '../parse-formula';

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

    for (let index = 0; index < PARSED_TEXTS_CAPACITY; index++) {
      parseFormula(`other + ${index}`);
    }

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
