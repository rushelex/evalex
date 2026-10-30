import type { FormulaDataType } from '../../data-types';

import { fc, it } from '@fast-check/vitest';

import { formulaValueArbitrary } from '../../../testing-library';
import { FormulaArray, FormulaNumber, FormulaString, Kind } from '../../data-types';
import { admits } from '../admits';
import { kindsOf } from '../kinds-of';
import { type } from '../type';

const nestedNumbers = type.nested(type.number);

// Numbers, and lists of them nested a few levels deep
const { numbers } = fc.letrec<{ numbers: FormulaDataType }>((tie) => ({
  numbers: fc.oneof({ depthSize: 'small' }, formulaValueArbitrary(Kind.Number), fc.array(tie('numbers'), { maxLength: 3 }).map((items) => new FormulaArray(items))),
}));

function listedAt({ value, depth }: { value: FormulaDataType; depth: number }): FormulaDataType {
  return Array.from({ length: depth }).reduce<FormulaDataType>((inner) => new FormulaArray([inner]), value);
}

describe(admits, () => {
  it.prop([formulaValueArbitrary(), fc.constantFrom(type.number, type.string, type.array(type.string), type.union(type.number, type.null), type.any, type.variable('T'))])('should take a value where a type without nested lists stands by its kind alone', (value, formulaType) => {
    expect(admits({ formulaType, value })).toBe(kindsOf(formulaType).some((kind) => kind === Kind.Any || kind === value.kind));
  });

  it.prop([numbers])('should take numbers and lists of them at any depth where it declares nested numbers', (value) => {
    expect(admits({ formulaType: nestedNumbers, value })).toBe(true);
  });

  it.prop([numbers, formulaValueArbitrary(Kind.String), fc.nat({ max: 3 })])('should refuse a list of numbers that holds a value of another kind at any depth', (value, text, depth) => {
    expect(admits({ formulaType: nestedNumbers, value: new FormulaArray([value, listedAt({ value: text, depth })]) })).toBe(false);
  });

  it.each([
    { written: '"1"', value: new FormulaString('1'), admitted: false },
    { written: '[]', value: new FormulaArray([]), admitted: true },
    { written: '[[], 1]', value: new FormulaArray([new FormulaArray([]), new FormulaNumber(1)]), admitted: true },
  ])('should take $written where it declares nested numbers: $admitted', ({ value, admitted }) => {
    expect(admits({ formulaType: nestedNumbers, value })).toBe(admitted);
  });
});
