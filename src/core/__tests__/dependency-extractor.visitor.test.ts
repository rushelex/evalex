import { DependencyExtractorVisitor } from '../dependency-extractor.visitor';
import { parseFormula } from '../parse-formula';

function dependenciesOf(formula: string): ReadonlySet<string> {
  return DependencyExtractorVisitor.getDependencies(parseFormula(formula));
}

describe('DependencyExtractorVisitor.getDependencies', () => {
  it('should extract dependencies from a formula', () => {
    expect(dependenciesOf('a + b')).toEqual(new Set(['a', 'b']));
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
    expect(dependenciesOf(formula)).toEqual(new Set(expected));
  });

  it('should report the host variables a let reads, but not its own names', () => {
    expect(dependenciesOf('let net = price * qty, tax = net * rate in net + tax')).toEqual(new Set(['price', 'qty', 'rate']));
  });

  it('should report a host variable a let reads before an inner let hides its name', () => {
    expect(dependenciesOf('total + (let total = 1 in total)')).toEqual(new Set(['total']));
  });
});
