import { MathQuillField, selectionDirection } from "../components";
import { MqNodeViaDom } from "./mq-node";

type DomCursor =
  | { type: "cursor"; el: Element }
  | { type: "selection"; el: Element; headSide: 1 | -1 };

/**
 * This class behaves similarly to a mathquill cursor,
 * but it avoids reaching into mathquill internals.
 * This works directly on the HTML that mathquill produces.
 *
 * A cursor is a position inside a group. There are a few ways to think of it:
 * 1. Either at the start of the group or after a non-group node.
 * 2. Either at the end of the group or before a non-group node.
 * 3. Either before/after a non-group node, or at the single location inside an empty group
 * 4. At some index `0` through `n` _inclusive_ in a group with `n` children.
 */
export class MqCursorViaDom {
  private readonly mq: MathQuillField;
  /**
   * The domCursor represents the head of the selection.
   * Since we only have access to DOM nodes, this is a bit awkward.
   */
  private readonly domCursor: DomCursor;

  constructor(mq: MathQuillField, domCursor: DomCursor) {
    this.mq = mq;
    this.domCursor = domCursor;
  }

  nodeBefore(): MqNodeViaDom | undefined {
    const sibling =
      this.domCursor.type === "selection" && this.domCursor.headSide === 1
        ? this.domCursor.el.lastElementChild
        : this.domCursor.el.previousElementSibling;
    if (sibling) return new MqNodeViaDom(this.mq, sibling);
    else return undefined;
  }

  nodeAfter(): MqNodeViaDom | undefined {
    const sibling =
      this.domCursor.type === "selection" && this.domCursor.headSide === -1
        ? this.domCursor.el.firstElementChild
        : this.domCursor.el.nextElementSibling;
    if (sibling) return new MqNodeViaDom(this.mq, sibling);
    else return undefined;
  }

  nodeInDirection(dir: 1 | -1): MqNodeViaDom | undefined {
    return dir === 1 ? this.nodeAfter() : this.nodeBefore();
  }

  parentGroup() {
    const parent = this.domCursor.el.parentElement;
    if (!parent) throw new Error("Invalid cursor.");
    return new MqNodeViaDom(this.mq, parent);
  }
}

/**
 * Get the head of the selection.
 * When the selection is a point (i.e. just the cursor), it represents that point.
 * Otherwise, this is the head of the selection, which is what moves when you shift-arrow.
 */
export function getCursorHead(mq: MathQuillField): MqCursorViaDom | undefined {
  const cursorDom = mq.el().querySelector(".dcg-mq-cursor");
  if (cursorDom) {
    return new MqCursorViaDom(mq, { type: "cursor", el: cursorDom });
  }
  const selectionDom = mq.el().querySelector(".dcg-mq-selection");
  if (selectionDom) {
    const direction = selectionDirection(mq);
    return new MqCursorViaDom(mq, {
      type: "selection",
      el: selectionDom,
      headSide: direction,
    });
  }
  return undefined;
}
