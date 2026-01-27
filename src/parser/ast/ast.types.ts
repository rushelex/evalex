import type { IVisitor } from './ast.visitor';

export interface IVisitable {
  accept: <T>(visitor: IVisitor<T>) => T;
}

export type AstNode
  = | ILiteralNode
    | IIdentifierNode
    | IUnaryExpressionNode
    | IBinaryExpressionNode
    | ICallExpressionNode
    | IMemberExpressionNode
    | IConditionalExpressionNode
    | IArrayExpressionNode;

export interface Location {
  source?: any;
  start: { offset: number; line: number; column: number };
  end: { offset: number; line: number; column: number };
}

export interface ILiteralNode extends IVisitable {
  type: 'Literal';
  value: string | number | boolean | null | undefined;
  raw: string;
  location: Location;
}

export interface IIdentifierNode extends IVisitable {
  type: 'Identifier';
  name: string;
  location: Location;
}

export interface IUnaryExpressionNode extends IVisitable {
  type: 'UnaryExpression';
  operator: string;
  arg: AstNode;
  prefix: boolean;
  location: Location;
}

export interface IBinaryExpressionNode extends IVisitable {
  type: 'BinaryExpression';
  operator: string;
  left: AstNode;
  right: AstNode;
  location: Location;
}

export interface ICallExpressionNode extends IVisitable {
  type: 'CallExpression';
  callee: IIdentifierNode | IMemberExpressionNode;
  args: AstNode[];
  location: Location;
}

export interface IMemberExpressionNode extends IVisitable {
  type: 'MemberExpression';
  object: AstNode;
  property: IIdentifierNode; // В нашей грамматике свойство всегда Identifier (a.b, не a['b'])
  computed: false; // Пока false, т.к. нет поддержки a[b]
  location: Location;
}

export interface IConditionalExpressionNode extends IVisitable {
  type: 'ConditionalExpression';
  test: AstNode;
  consequent: AstNode;
  alternate: AstNode;
  location: Location;
}

export interface IArrayExpressionNode extends IVisitable {
  type: 'ArrayExpression';
  elements: AstNode[];
  location: Location;
}
