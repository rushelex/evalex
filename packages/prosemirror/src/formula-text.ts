import type { Node } from 'prosemirror-model';

import type { FieldSpan } from './field-span';

const FORMULAS = new Set(['formula', 'formulaBlock']);

/** A child of a formula node with where it starts in the document and in the formula text. */
interface Segment {
  readonly node: Node;
  readonly pos: number;
  readonly offset: number;
  readonly length: number;
}

/**
 * A formula node of a document read as formula text, which maps between offsets in the text and positions in the
 * document: a field takes one position and as many offsets as its name has characters.
 */
export class FormulaText {
  /** The formula as evalex reads it, each field written as its name. */
  readonly text: string;
  /** Position of the start of the formula's content. */
  readonly from: number;
  /** Position of the end of its content. */
  readonly to: number;
  readonly #segments: readonly Segment[];

  /**
   * @param node - A `formula` or `formulaBlock` node.
   * @param pos - Its position in the document.
   */
  constructor(readonly node: Node, readonly pos: number) {
    const segments: Segment[] = [];
    let offset = 0;

    node.forEach((child, childOffset) => {
      const { length } = child.textContent;

      segments.push({ node: child, pos: pos + 1 + childOffset, offset, length });
      offset += length;
    });

    this.text = node.textContent;
    this.from = pos + 1;
    this.to = pos + node.nodeSize - 1;
    this.#segments = segments;
  }

  /** Every formula of a document, in document order. */
  static all(doc: Node): FormulaText[] {
    const formulas: FormulaText[] = [];

    doc.descendants((node, pos) => {
      if (!FormulaText.isFormula(node)) {
        return true;
      }

      formulas.push(new FormulaText(node, pos));

      return false;
    });

    return formulas;
  }

  /** The formula whose content holds the position, its ends included. */
  static at(doc: Node, pos: number): FormulaText | undefined {
    const $pos = doc.resolve(pos);

    for (let depth = $pos.depth; depth > 0; depth--) {
      if (FormulaText.isFormula($pos.node(depth))) {
        return new FormulaText($pos.node(depth), $pos.before(depth));
      }
    }

    return undefined;
  }

  static isFormula(node: Node): boolean {
    return FORMULAS.has(node.type.name);
  }

  static isField(node: Node | null | undefined): node is Node {
    return node?.type.name === 'formulaField';
  }

  /** Whether the position is inside the content of this formula, its ends included. */
  holds(pos: number): boolean {
    return this.from <= pos && pos <= this.to;
  }

  /** The document position of a text offset; an offset inside the name of a field maps to the position after it. */
  posAt(offset: number): number {
    const segment = this.#segments.find(({ offset: start, length }) => offset <= start + length);

    if (!segment) {
      return this.to;
    }

    const inside = offset - segment.offset;

    if (segment.node.isText || inside === 0) {
      return segment.pos + inside;
    }

    return segment.pos + 1;
  }

  /** The text offset of a document position inside the formula. */
  offsetAt(pos: number): number {
    const segment = this.#segments.find((candidate) => pos <= candidate.pos + candidate.node.nodeSize);

    if (!segment) {
      return this.text.length;
    }

    const inside = Math.max(0, pos - segment.pos);

    return segment.offset + (segment.node.isText ? inside : Math.min(inside, 1) * segment.length);
  }

  /** The fields inside the formula, in text order. */
  fields(): FieldSpan[] {
    return this.#segments.flatMap(({ node, pos, offset, length }) => (FormulaText.isField(node) ? [{ node, pos, from: offset, to: offset + length }] : []));
  }
}
