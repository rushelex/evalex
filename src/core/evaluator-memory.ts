import type { FormulaCell } from './formula-evaluator';

/** A read of host data a formula made: the value at `key` of `owner`, or `ABSENT`, and its shape, see `hostShape`. */
export interface FieldRead {
  readonly kind: 'field';
  readonly owner: object;
  readonly key: string | number;
  readonly value: unknown;
  readonly shape: unknown;
}

/** A read of another formula cell, and what that cell held. */
export interface CellRead {
  readonly kind: 'cell';
  readonly owner: object;
  readonly key: string | number;
  readonly result: FormulaCell;
}

/** A read of where a container sits: the container that holds it and its key there. */
export interface PlaceRead {
  readonly kind: 'place';
  readonly container: object;
  readonly parent: object | undefined;
  readonly key: string | number | undefined;
}

export type Read = FieldRead | CellRead | PlaceRead;

/** What a formula cell gave when it was last computed, and every read its formula made, in order. */
export interface CellMemo {
  readonly text: string;
  /** The nesting the cell took, see `EvaluationPass`. */
  readonly nesting: number;
  readonly reads: readonly Read[];
  readonly result: FormulaCell;
}

/** The copy of a container in the view of a pass, and what its fields held, to keep the copy while they hold the same. */
export interface ViewMemo {
  readonly view: object;
  /** Each own field as four items: its key, its attributes, and what it held: a value, a cell's result, or its accessors. */
  readonly fields: readonly unknown[];
  pass: number;
}

/** What an evaluator keeps for one container: its formula cells by key as text, as the view reads it, and its copy. */
export interface ContainerMemo {
  cells: Map<string, CellMemo> | undefined;
  view: ViewMemo | undefined;
}

/**
 * What an evaluator keeps between passes, by host object, so a pass computes again only the cells whose reads changed.
 *
 * @remarks
 * Kept in a weak map, it lives as long as the host keeps its data.
 */
export type EvaluatorMemory = WeakMap<object, ContainerMemo>;
