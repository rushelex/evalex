import type { FormulaDataType } from '../data-types';
import type { FormulaType } from './formula-type';

/**
 * A {@link FormulaType} that also carries, for the compiler only, the class of the values it describes.
 *
 * @remarks
 * Only `type` builds one: the class exists for the compiler alone and is absent at run time, so a plain
 * {@link FormulaType} never passes for a `ValueType`.
 */
export type ValueType<TValue extends FormulaDataType> = FormulaType & {
  // Read and written, so `ValueType<A>` and `ValueType<B>` are assignable only when `A` and `B` are the same
  readonly '~value': (value: TValue) => TValue;
};
