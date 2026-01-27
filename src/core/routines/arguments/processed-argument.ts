import type { AST } from '../../../parser';
import type { FormulaDataType } from '../../data-types';

export class ProcessedArgument<T extends FormulaDataType = FormulaDataType> {
  constructor(
    public readonly dataType: T,
    public readonly node: AST.AstNode,
  ) {}

  public get location(): AST.Location {
    return this.node.location;
  }
}
