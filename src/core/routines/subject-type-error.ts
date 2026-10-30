import type { AST } from '../../parser';
import type { FormulaDataType } from '../data-types';
import type { FormulaError } from '../errors';
import type { FormulaType } from '../types';

import { admits } from '../types';
import { nestedTypeError } from './arguments';

/**
 * The error a method fails with on the value it is called on when none of its signatures takes it, though the method
 * exists on the kind of the value: only a nested type takes fewer values than the kinds a method is found by.
 */
export function subjectTypeError({ subjects, instance, location }: {
  readonly subjects: readonly FormulaType[];
  readonly instance: FormulaDataType;
  readonly location: AST.Location;
}): FormulaError | undefined {
  const [nested] = subjects.flatMap((subject) => (subject.kind === 'Nested' ? [subject] : []));

  return nested && !subjects.some((subject) => admits({ formulaType: subject, value: instance }))
    ? nestedTypeError({ value: instance, nested, position: 0, location })
    : undefined;
}
