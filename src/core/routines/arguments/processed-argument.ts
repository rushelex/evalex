import type { AST } from '../../../parser';
import type { FormulaDataType } from '../../data-types';

export class ProcessedArgument<T extends FormulaDataType = FormulaDataType> {
  readonly dataType: T;
  readonly node: AST.AstNode;

  constructor(
    dataType: T,
    node: AST.AstNode,
  ) {
    this.dataType = dataType;
    this.node = node;
  }

  get location(): AST.Location {
    return this.node.location;
  }
}
