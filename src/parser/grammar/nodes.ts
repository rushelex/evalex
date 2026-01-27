import type {
  AstNode,
  IArrayExpressionNode,
  IBinaryExpressionNode,
  ICallExpressionNode,
  IConditionalExpressionNode,
  IIdentifierNode,
  ILiteralNode,
  IMemberExpressionNode,
  IUnaryExpressionNode,
  IVisitor,
  Location,
} from '../ast';

export class LiteralNode implements ILiteralNode {
  public type = 'Literal' as const;

  constructor(
    public value: string | number | boolean | null,
    public raw: string,
    public location: Location,
  ) {}

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitLiteralNode(this);
  }
}

export class IdentifierNode implements IIdentifierNode {
  public type = 'Identifier' as const;

  constructor(
    public name: string,
    public location: Location,
  ) {}

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitIdentifierNode(this);
  }
}

export class UnaryExpressionNode implements IUnaryExpressionNode {
  public type = 'UnaryExpression' as const;

  constructor(
    public operator: string,
    public arg: AstNode,
    public prefix: boolean,
    public location: Location,
  ) {}

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitUnaryExpressionNode(this);
  }
}

export class BinaryExpressionNode implements IBinaryExpressionNode {
  public type = 'BinaryExpression' as const;

  constructor(
    public operator: string,
    public left: AstNode,
    public right: AstNode,
    public location: Location,
  ) {}

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitBinaryExpressionNode(this);
  }
}

export class CallExpressionNode implements ICallExpressionNode {
  public type = 'CallExpression' as const;

  constructor(
    public callee: IIdentifierNode | IMemberExpressionNode,
    public args: AstNode[],
    public location: Location,
  ) {}

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitCallExpressionNode(this);
  }
}

export class MemberExpressionNode implements IMemberExpressionNode {
  public type = 'MemberExpression' as const;

  constructor(
    public object: AstNode,
    public property: IIdentifierNode,
    public computed: false = false,
    public location: Location,
  ) {}

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitMemberExpressionNode(this);
  }
}

export class ConditionalExpressionNode implements IConditionalExpressionNode {
  public type = 'ConditionalExpression' as const;

  constructor(
    public test: AstNode,
    public consequent: AstNode,
    public alternate: AstNode,
    public location: Location,
  ) {}

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitConditionalExpressionNode(this);
  }
}

export class ArrayExpressionNode implements IArrayExpressionNode {
  public type = 'ArrayExpression' as const;

  constructor(
    public elements: AstNode[],
    public location: Location,
  ) {}

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitArrayExpressionNode(this);
  }
}
