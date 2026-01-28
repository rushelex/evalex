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
  type = 'Literal' as const;
  value: string | number | boolean | null;
  raw: string;
  location: Location;

  constructor(
    value: string | number | boolean | null,
    raw: string,
    location: Location,
  ) {
    this.value = value;
    this.raw = raw;
    this.location = location;
  }

  accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitLiteralNode(this);
  }
}

export class IdentifierNode implements IIdentifierNode {
  type = 'Identifier' as const;
  name: string;
  location: Location;

  constructor(
    name: string,
    location: Location,
  ) {
    this.name = name;
    this.location = location;
  }

  accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitIdentifierNode(this);
  }
}

export class UnaryExpressionNode implements IUnaryExpressionNode {
  type = 'UnaryExpression' as const;
  operator: string;
  arg: AstNode;
  prefix: boolean;
  location: Location;

  constructor(
    operator: string,
    arg: AstNode,
    prefix: boolean,
    location: Location,
  ) {
    this.operator = operator;
    this.arg = arg;
    this.prefix = prefix;
    this.location = location;
  }

  accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitUnaryExpressionNode(this);
  }
}

export class BinaryExpressionNode implements IBinaryExpressionNode {
  type = 'BinaryExpression' as const;
  operator: string;
  left: AstNode;
  right: AstNode;
  location: Location;

  constructor(
    operator: string,
    left: AstNode,
    right: AstNode,
    location: Location,
  ) {
    this.operator = operator;
    this.left = left;
    this.right = right;
    this.location = location;
  }

  accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitBinaryExpressionNode(this);
  }
}

export class CallExpressionNode implements ICallExpressionNode {
  type = 'CallExpression' as const;
  callee: IIdentifierNode | IMemberExpressionNode;
  args: AstNode[];
  location: Location;

  constructor(
    callee: IIdentifierNode | IMemberExpressionNode,
    args: AstNode[],
    location: Location,
  ) {
    this.callee = callee;
    this.args = args;
    this.location = location;
  }

  accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitCallExpressionNode(this);
  }
}

export class MemberExpressionNode implements IMemberExpressionNode {
  type = 'MemberExpression' as const;
  object: AstNode;
  property: IIdentifierNode;
  computed: false;
  location: Location;

  constructor(
    object: AstNode,
    property: IIdentifierNode,
    computed: false = false,
    location: Location,
  ) {
    this.object = object;
    this.property = property;
    this.computed = computed;
    this.location = location;
  }

  accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitMemberExpressionNode(this);
  }
}

export class ConditionalExpressionNode implements IConditionalExpressionNode {
  type = 'ConditionalExpression' as const;
  test: AstNode;
  consequent: AstNode;
  alternate: AstNode;
  location: Location;

  constructor(
    test: AstNode,
    consequent: AstNode,
    alternate: AstNode,
    location: Location,
  ) {
    this.test = test;
    this.consequent = consequent;
    this.alternate = alternate;
    this.location = location;
  }

  accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitConditionalExpressionNode(this);
  }
}

export class ArrayExpressionNode implements IArrayExpressionNode {
  type = 'ArrayExpression' as const;
  elements: AstNode[];
  location: Location;

  constructor(
    elements: AstNode[],
    location: Location,
  ) {
    this.elements = elements;
    this.location = location;
  }

  accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitArrayExpressionNode(this);
  }
}
