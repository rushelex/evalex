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

  function buildUnaryExpression(operators, operand, ruleLocation) {
    return operators.reduceRight((result, operator) => {
      return new Nodes.UnaryExpressionNode(
        operator,
        result,
        true,
        ruleLocation,
      );
    }, operand);
  }
}

//==============================
// START RULE
//==============================

Start "entry point"
  = _ expr:Expression? _ { return expr || new Nodes.LiteralNode(null, 'null', location()); }

//==============================
// WHITESPACE & BASIC PUNCTUATION
//==============================

_ = t:[ \t\n\r]* { return { token: t, location: location() }; }
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
  = num:$("-"? [0-9]+ ("." [0-9]+)?) { return new Nodes.LiteralNode(parseFloat(num), num, location()); }

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

LogicalOrOperator = "||" / "or"
LogicalAndOperator = "&&" / "and"
ComparisonOperator = "==" / "!=" / "<=" / ">=" / "<" / ">"
InOperator = "in"
AdditiveOperator = "+" / "-"
MultiplicativeOperator = "*" / "/" / "%"
PowerOperator = "^"
UnaryOperator = "-" / "not" / "!"

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

// Arguments rule depends on Expression, so it's placed after Atom/Primary but before full Expression hierarchy that uses it.
Arguments "argument list"
  // Case 1: Starts with an Expression (handles valid arguments, (a,), (a,,b))
  = head:Expression _ tail:(_ COMMA _ Expression)* _ trailingComma:(COMMA _)? {
      if (trailingComma) {
        const errorLocation = trailingComma[0].location;
        error(`Unexpected comma or missing argument in function call.`, errorLocation);
      }
      let result = [head];
      tail.forEach(item => result.push(item[3]));
      return result;
    }
  // Case 2: Starts with a Comma (handles leading comma error like (,a))
  / leadingComma:COMMA { // If the first non-whitespace token is a comma
      error(`Arguments cannot start with a comma.`, leadingComma.location);
    }
  // Case 3: Empty argument list (e.g., "()" or "[]" or just whitespace inside)
  / _ { // Matches if only whitespace or if it's immediately followed by RPAREN/RBRACKET
      return [];
    }

//==============================
// ERROR HANDLING RULES (USED IN PRIMARY EXPRESSION)
//==============================

InvalidStandaloneMemberAccess "invalid standalone member access"
  = head:Atom _ dot:DOT _ prop:Identifier !(_ LPAREN) // Ensure it's not a call
    {
      const errorLocation = {
        source: dot.location.source,
        start: dot.location.start,
        end: prop.location.end
      };
      error(`Expected function '${prop.name}()' to be called.`, errorLocation);
    }


//==============================
// EXPRESSION HIERARCHY (HIGHEST TO LOWEST PRECEDENCE, THEN MAIN EXPRESSION RULE)
//==============================

// Suffixes for LeftHandSideExpression
MemberCallSuffix
  = _ DOT _ p:Identifier _ lparen:LPAREN _ args:Arguments _ rparen:RPAREN? {
      if (!rparen) {
        const errorStartLocation = lparen.location.start;
        const errorEndLocation = args && args.length > 0 ? args[args.length - 1].location.end : lparen.location.end;
        error('Expected token ")".', {
          source: lparen.location.source,
          start: errorStartLocation,
          end: errorEndLocation
        });
      }
      return {
        type: "MemberCallSuffix",
        property: p,
        args: args
      };
    }

DirectCallSuffix
  = _ lparen:LPAREN _ args:Arguments _ rparen:RPAREN? {
      if (!rparen) {
        const errorStartLocation = lparen.location.start;
        const errorEndLocation = args && args.length > 0 ? args[args.length - 1].location.end : lparen.location.end;
        error('Expected token ")".', {
          source: lparen.location.source,
          start: errorStartLocation,
          end: errorEndLocation
        });
      }
      return {
        type: "DirectCallSuffix",
        args: args
      };
    }

// Primary Expression (Handles calls, member access, and basic atoms)
// This is effectively the highest precedence part of the expression chain.
PrimaryExpression
  = InvalidStandaloneMemberAccess // Check for specific errors first
  / head:Atom
    tail:(
        MemberCallSuffix
      / DirectCallSuffix
    )*
    {
      return tail.reduce((currentLHS, suffixInfo) => {
        if (suffixInfo.type === "MemberCallSuffix") {
          const memberExpr = new Nodes.MemberExpressionNode(currentLHS, suffixInfo.property, false, location());
          return new Nodes.CallExpressionNode(memberExpr, suffixInfo.args, location());
        }
        else if (suffixInfo.type === "DirectCallSuffix") {
          return new Nodes.CallExpressionNode(currentLHS, suffixInfo.args, location());
        }
        return currentLHS; // Should not happen with current grammar for suffixes
      }, head);
    }

// Unary
UnaryExpression
  = operators:(UnaryOperator)* _ operand:PrimaryExpression
    { return operators.length > 0 ? buildUnaryExpression(operators, operand, location()) : operand; }
  / PrimaryExpression // Fallback if no unary operator is present

// Power (Right Associative)
PowerExpression
  = head:UnaryExpression _ tail:(PowerOperator _ PowerExpression)?
    {
      if (!tail) { return head; }
      const leftOperandNode = head;
      const operatorString = tail[0];
      const rightOperandNode = tail[2];
      const preciseLocation = {
        source: leftOperandNode.location.source,
        start: location().start, // Correctly uses current rule's start for the whole op
        end: rightOperandNode.location.end
      };
      return new Nodes.BinaryExpressionNode(operatorString, leftOperandNode, rightOperandNode, preciseLocation);
    }

// Multiplicative
MultiplicativeExpression
  = head:PowerExpression tail:(_ MultiplicativeOperator _ PowerExpression)* _
    { return buildBinaryExpression(head, tail, location()); }

// Additive
AdditiveExpression
  = head:MultiplicativeExpression tail:(_ AdditiveOperator _ MultiplicativeExpression)* _
    { return buildBinaryExpression(head, tail, location()); }

// Comparison
ComparisonExpression
  = head:AdditiveExpression _ tail:(
      ComparisonOperator _ AdditiveExpression /
      InOperator _ AdditiveExpression
    )?
    {
      if (!tail) { return head; }
      const leftOperandNode = head;
      const operatorString = tail[0];
      const rightOperandNode = tail[2];
      const preciseLocation = {
        source: leftOperandNode.location.source,
        start: leftOperandNode.location.start,
        end: rightOperandNode.location.end
      };
      return new Nodes.BinaryExpressionNode(operatorString, leftOperandNode, rightOperandNode, preciseLocation);
    }

// Logical AND
LogicalAndExpression
  = head:ComparisonExpression tail:(_ LogicalAndOperator _ ComparisonExpression)* _
    { return buildBinaryExpression(head, tail, location()); }

// Logical OR
LogicalOrExpression
  = head:LogicalAndExpression tail:(_ LogicalOrOperator _ LogicalAndExpression)* _
    { return buildBinaryExpression(head, tail, location()); }

// Conditional (Ternary) Expression - This is the main 'Expression' entry for the hierarchy
Expression "expression (conditional)"
  = condition:LogicalOrExpression _ "?" _ consequent:Expression _ ":" _ alternate:Expression
    {
      return new Nodes.ConditionalExpressionNode(
        condition,
        consequent,
        alternate,
        location()
      );
    }
  / LogicalOrExpression
