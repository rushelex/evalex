import type { AST } from '../../../parser';
import type { FormulaDataType } from '../../data-types';

export class ProcessedArgument<T extends FormulaDataType = FormulaDataType> {
  readonly dataType: T;
  readonly node: AST.AstNode;
  readonly #origin: AST.Location;

  /**
   * @param dataType - the evaluated argument
   * @param node - the argument as written in the call
   * @param origin - the part of the formula the value came from, narrower than `node` when `node` handed on a value
   * from one of its parts, as `if(flag, 1, "a")` hands on `"a"`
   */
  constructor(
    dataType: T,
    node: AST.AstNode,
    origin: AST.Location = node.location,
  ) {
    this.dataType = dataType;
    this.node = node;
    this.#origin = origin;
  }

  /** Where an error about this value points: the part of the formula the value came from. */
  get location(): AST.Location {
    return this.#origin;
  }
}
