import type { Node } from 'prosemirror-model';

/** A field inside a formula with its position in the document and the span of its name in the text. */
export interface FieldSpan {
  readonly node: Node;
  readonly pos: number;
  readonly from: number;
  readonly to: number;
}
