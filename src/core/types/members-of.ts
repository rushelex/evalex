import type { FormulaType } from './formula-type';

/** The types a value of `formulaType` is one of: the members of a union, at any depth, or the type itself. */
export function membersOf(formulaType: FormulaType): readonly FormulaType[] {
  return formulaType.kind === 'Union' ? formulaType.of.flatMap(membersOf) : [formulaType];
}
