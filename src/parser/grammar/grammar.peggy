{
  function buildBinaryExpression(head, tail, ruleLocation) {
    return tail.reduce((result, element) => {
      return new Nodes.BinaryExpressionNode(
        element[1],
        result,
        element[3],
        ruleLocation,
      );
    }, head);
  }

  function throwUnclosedParen(lparen, args) {
    const errorStartLocation = lparen.location.start;
    const errorEndLocation = args && args.length > 0 ? args[args.length - 1].location.end : lparen.location.end;
    error('Expected token ")".', {
      source: lparen.location.source,
      start: errorStartLocation,
      end: errorEndLocation
    });
  }
}

//==============================
// START RULE
//==============================

Start "entry point"
  = _ expr:Expression? _ { return expr || new Nodes.LiteralNode(null, 'null', location()); }

//==============================
// WHITESPACE & BASIC TOKENS
//==============================

_ = [ \t\n\r]*
DOT = t:"." { return { token: t, location: location() }; }
COMMA = t:"," { return { token: t, location: location() }; }
LPAREN = t:"(" { return { token: t, location: location() }; }
RPAREN = t:")" { return { token: t, location: location() }; }
LBRACKET = t:"[" { return { token: t, location: location() }; }
RBRACKET = t:"]" { return { token: t, location: location() }; }

//==============================
// LITERALS
//==============================

Literal
  = NullLiteral
  / UndefinedLiteral
  / BooleanLiteral
  / NumberLiteral
  / StringLiteral

NullLiteral
  = "null" !IdentifierChar { return new Nodes.LiteralNode(null, 'null', location()); }

UndefinedLiteral
  = "undefined" !IdentifierChar { return new Nodes.LiteralNode(undefined, 'undefined', location()); }

BooleanLiteral
  = val:("true" / "false") !IdentifierChar { return new Nodes.LiteralNode(val === "true", val, location()); }

NumberLiteral
  = num:$([0-9]+ ("." [0-9]+)? ([eE] [+-]? [0-9]+)?) { return new Nodes.LiteralNode(parseFloat(num), num, location()); }
  / num:$("." [0-9]+ ([eE] [+-]? [0-9]+)?) { return new Nodes.LiteralNode(parseFloat(num), num, location()); }

StringLiteral
  = '"' chars:DoubleQuotedChar* '"' { return new Nodes.LiteralNode(chars.join(""), '"' + chars.join("") + '"', location()); }
  / "'" chars:SingleQuotedChar* "'" { return new Nodes.LiteralNode(chars.join(""), "'" + chars.join("") + "'", location()); }

DoubleQuotedChar
  = !('"' / "\\") char:. { return char; }
  / "\\" escape:EscapeSequence { return escape; }

SingleQuotedChar
  = !("'" / "\\") char:. { return char; }
  / "\\" escape:EscapeSequence { return escape; }

EscapeSequence
  = "'" { return "'"; }
  / '"' { return '"'; }
  / "\\" { return "\\"; }
  / "b" { return "\b"; }
  / "f" { return "\f"; }
  / "n" { return "\n"; }
  / "r" { return "\r"; }
  / "t" { return "\t"; }
  / "v" { return "\v"; }
  / "u" digits:$([0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F])
    { return String.fromCharCode(parseInt(digits, 16)); }

//==============================
// IDENTIFIERS & KEYWORDS
//==============================

Identifier "identifier"
  = !Keyword name:RawIdentifier { return new Nodes.IdentifierNode(name, location()); }

RawIdentifier
  = $([a-zA-Z_] [a-zA-Z0-9_]*)

IdentifierChar
  = [a-zA-Z0-9_]

Keyword
  = ("null" / "undefined" / "true" / "false" / "or" / "and" / "not" / "in") !IdentifierChar

//==============================
// OPERATORS
//==============================

LogicalOrOperator = "||" / "or" !IdentifierChar { return "or"; }
LogicalAndOperator = "&&" / "and" !IdentifierChar { return "and"; }
ComparisonOperator = "==" / "!=" / "<=" / ">=" / "<" / ">"
InOperator = "in" !IdentifierChar { return "in"; }
AdditiveOperator = "+" / "-"
MultiplicativeOperator = "*" / "/" / "%"
PowerOperator = "^"
UnaryOperator = "-" / "not" !IdentifierChar { return "not"; } / "!"

//==============================
// ATOMIC EXPRESSIONS & RELATED
//==============================

Atom
  = Literal
  / Identifier
  / GroupedExpression
  / ArrayLiteral

GroupedExpression "grouped expression"
  = lparen:LPAREN _ expr:Expression? _ rparen:RPAREN {
      if (expr) {
        return expr;
      } else {
        const emptyParenLocation = {
          source: lparen.location.source,
          start: lparen.location.start,
          end: rparen.location.end
        };
        error(`Empty parentheses "()" are not a valid expression.`, emptyParenLocation);
      }
    }

ArrayLiteral "array literal"
  = LBRACKET _ elements:Arguments _ RBRACKET
    { return new Nodes.ArrayExpressionNode(elements ? elements.filter(el => el !== null) : [], location()); }

//==============================
// ARGUMENTS HELPER (FOR CALLS & ARRAYS)
//==============================

Arguments "argument list"
  = head:Expression _ tail:(_ COMMA _ Expression)* _ trailingComma:(COMMA _)? {
      if (trailingComma) {
        const errorLocation = trailingComma[0].location;
        error(`Unexpected comma or missing argument in function call.`, errorLocation);
      }
      let result = [head];
      tail.forEach(item => result.push(item[3]));
      return result;
    }
  / leadingComma:COMMA {
      error(`Arguments cannot start with a comma.`, leadingComma.location);
    }
  / _ {
      return [];
    }

//==============================
// EXPRESSION HIERARCHY (HIGHEST TO LOWEST PRECEDENCE)
//==============================

// Suffixes for PrimaryExpression
MemberCallSuffix
  = _ DOT _ p:Identifier _ lparen:LPAREN _ args:Arguments _ rparen:RPAREN? {
      if (!rparen) { throwUnclosedParen(lparen, args); }
      return { type: "MemberCallSuffix", property: p, args: args };
    }

DirectCallSuffix
  = _ lparen:LPAREN _ args:Arguments _ rparen:RPAREN? {
      if (!rparen) { throwUnclosedParen(lparen, args); }
      return { type: "DirectCallSuffix", args: args };
    }

StandaloneMemberAccess "invalid standalone member access"
  = _ dot:DOT _ prop:Identifier !(_ LPAREN) {
      const errorLocation = {
        source: dot.location.source,
        start: dot.location.start,
        end: prop.location.end
      };
      error(`Expected function '${prop.name}()' to be called.`, errorLocation);
    }

// Primary Expression (handles atoms, function calls, and method calls)
PrimaryExpression
  = head:Atom
    tail:(
        MemberCallSuffix
      / DirectCallSuffix
      / StandaloneMemberAccess
    )*
    {
      return tail.reduce((currentLHS, suffixInfo) => {
        if (suffixInfo.type === "MemberCallSuffix") {
          const memberExpr = new Nodes.MemberExpressionNode(currentLHS, suffixInfo.property, false, location());
          return new Nodes.CallExpressionNode(memberExpr, suffixInfo.args, location());
        }
        if (suffixInfo.type === "DirectCallSuffix") {
          return new Nodes.CallExpressionNode(currentLHS, suffixInfo.args, location());
        }
        return currentLHS;
      }, head);
    }

// Unary (recursive for correct handling of chained unary operators: --5, not not x)
UnaryExpression
  = op:UnaryOperator _ operand:UnaryExpression
    { return new Nodes.UnaryExpressionNode(op, operand, true, location()); }
  / PrimaryExpression

// Power (right-associative)
PowerExpression
  = head:UnaryExpression _ tail:(PowerOperator _ PowerExpression)?
    {
      if (!tail) { return head; }
      return new Nodes.BinaryExpressionNode(tail[0], head, tail[2], {
        source: head.location.source,
        start: location().start,
        end: tail[2].location.end
      });
    }

// Multiplicative
MultiplicativeExpression
  = head:PowerExpression tail:(_ MultiplicativeOperator _ PowerExpression)*
    { return buildBinaryExpression(head, tail, location()); }

// Additive
AdditiveExpression
  = head:MultiplicativeExpression tail:(_ AdditiveOperator _ MultiplicativeExpression)*
    { return buildBinaryExpression(head, tail, location()); }

// Comparison (non-chainable: only one comparison operator per expression level)
ComparisonExpression
  = head:AdditiveExpression tail:(
      _ ComparisonOperator _ AdditiveExpression
    / _ InOperator _ AdditiveExpression
    )?
    {
      if (!tail) { return head; }
      return new Nodes.BinaryExpressionNode(tail[1], head, tail[3], {
        source: head.location.source,
        start: head.location.start,
        end: tail[3].location.end
      });
    }

// Logical AND
LogicalAndExpression
  = head:ComparisonExpression tail:(_ LogicalAndOperator _ ComparisonExpression)*
    { return buildBinaryExpression(head, tail, location()); }

// Logical OR
LogicalOrExpression
  = head:LogicalAndExpression tail:(_ LogicalOrOperator _ LogicalAndExpression)*
    { return buildBinaryExpression(head, tail, location()); }

// Conditional (Ternary)
Expression "expression"
  = condition:LogicalOrExpression _ "?" _ consequent:Expression _ ":" _ alternate:Expression
    { return new Nodes.ConditionalExpressionNode(condition, consequent, alternate, location()); }
  / LogicalOrExpression
