import type { AST } from '../parser';

/** A name in a formula and the role it plays there, as hover tells it. */
export interface NamePlace {
  /**
   * `read` for a name read as a value, `declaration` for a name a `let` declares, `function` for a name called as a
   * function, `method` for a method name after a dot.
   */
  readonly role: 'read' | 'declaration' | 'function' | 'method';
  readonly name: AST.IIdentifierNode;
  /** The node whose value the name stands for: the name read, the value declared, or the call. */
  readonly value: AST.AstNode;
  /** For a method, the value it is called on. */
  readonly subject?: AST.AstNode;
}
