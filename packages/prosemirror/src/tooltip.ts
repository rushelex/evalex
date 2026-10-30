import type { EditorView } from 'prosemirror-view';

/**
 * A box shown next to a position of the editor, above or below it, in the body of the page, so that no container of the
 * editor clips it.
 */
export class Tooltip {
  readonly dom: HTMLElement;

  constructor(className: string) {
    this.dom = document.createElement('div');
    this.dom.className = `pm-formula-tooltip ${className}`;
    this.dom.style.position = 'absolute';
  }

  get shown(): boolean {
    return this.dom.isConnected;
  }

  show({ view, pos, above, content }: { view: EditorView; pos: number; above: boolean; content: readonly (Node | string)[] }): void {
    const { ownerDocument } = view.dom;
    const window = ownerDocument.defaultView;
    const coords = view.coordsAtPos(pos);

    this.dom.replaceChildren(...content);
    ownerDocument.body.append(this.dom);
    this.dom.style.left = `${coords.left + (window?.scrollX ?? 0)}px`;
    this.dom.style.top = `${(above ? coords.top - this.dom.offsetHeight : coords.bottom) + (window?.scrollY ?? 0)}px`;
  }

  hide(): void {
    this.dom.remove();
  }
}
