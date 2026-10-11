import type {
  IArrayExpressionNode,
  IBinaryExpressionNode,
  ICallExpressionNode,
  IConditionalExpressionNode,
  IIdentifierNode,
  ILetExpressionNode,
  ILiteralNode,
  IMemberExpressionNode,
  IUnaryExpressionNode,
} from './ast.types';

export interface IVisitor<T> {
  visitLiteralNode: (node: ILiteralNode) => T;
  visitIdentifierNode: (node: IIdentifierNode) => T;
  visitUnaryExpressionNode: (node: IUnaryExpressionNode) => T;
  visitBinaryExpressionNode: (node: IBinaryExpressionNode) => T;
  visitCallExpressionNode: (node: ICallExpressionNode) => T;
  visitMemberExpressionNode: (node: IMemberExpressionNode) => T;
  visitConditionalExpressionNode: (node: IConditionalExpressionNode) => T;
  visitArrayExpressionNode: (node: IArrayExpressionNode) => T;
  visitLetExpressionNode: (node: ILetExpressionNode) => T;
}
