import type { AST } from '../parser';
import type { FormulaError } from './errors';

/** The part of a formula that read a cell, as written, and where it is. */
export interface CellReference {
  readonly name: string;
  readonly location: AST.Location;
}

/**
 * Thrown by the read of a cell that cannot give the reading formula a value, such as a cell of a cycle.
 *
 * @remarks
 * The read itself does not know where in the formula it happens. The evaluation of the formula catches the failure at
 * the innermost part being evaluated, the name, field read or call that read the cell, and throws the error `create`
 * makes for that part instead.
 */
export class CellReadFailure extends Error {
  readonly create: (reference: CellReference) => FormulaError;

  constructor(create: (reference: CellReference) => FormulaError) {
    super('A formula read a cell that cannot give it a value.');
    this.create = create;
  }
}
