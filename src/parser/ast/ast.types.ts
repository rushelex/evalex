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
    | IArrayExpressionNode
    | ILetExpressionNode;

export interface Location {
  start: { offset: number; line: number; column: number };
  end: { offset: number; line: number; column: number };
}

export interface ILiteralNode extends IVisitable {
  type: 'Literal';
  value: string | number | boolean | RegExp | null | undefined;
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

/** One `name = value` pair of a `let` expression. */
export interface ILetDeclaration {
  name: IIdentifierNode;
  value: AstNode;
  location: Location;
}

/** `let a = 1, b = a + 1 in a + b`: names visible to the later values and to the body. */
export interface ILetExpressionNode extends IVisitable {
  type: 'LetExpression';
  declarations: ILetDeclaration[];
  body: AstNode;
  location: Location;
}
