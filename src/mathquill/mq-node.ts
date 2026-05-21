import { MathQuillField } from "../components";

/**
 * This class behaves similarly to an individual mathquill node,
 * but it avoids reaching into mathquill internals. This works directly
 * on the HTML that mathquill produces.
 *
 * Note nodes are divided into groups and non-groups. The parent of a non-group
 * is a group, and the parent of a group is a non-group. The root node
 * is always a group, and the parent of the cursor is always a group.
 *
 * For example in `\sqrt{ab}^{3}`, there are 8 nodes:
 * 1. `a`
 * 2. `b`
 * 3. The group `{ab}`
 * 4. `\sqrt{ab}`
 * 5. `3`
 * 6. The group `{2}`
 * 7. `\sqrt{ab}^{3}`
 * 8. The root group `{\sqrt{ab}^{3}}`
 */
export class MqNodeViaDom {
  private readonly mq: MathQuillField;
  public readonly domNode: Element;

  constructor(mq: MathQuillField, domNode: Element) {
    this.mq = mq;
    this.domNode = domNode;
  }

  parent() {
    if (this.domNode.classList.contains("dcg-mq-root-block")) {
      return undefined;
    }
    let parent = this.domNode.parentElement;
    if (!parent) return undefined;
    if (isSelection(parent)) {
      parent = parent.parentElement;
      if (!parent) return undefined;
    }
    return new MqNodeViaDom(this.mq, parent);
  }

  nextSibling(): MqNodeViaDom | undefined {
    let sibling = this.domNode.nextElementSibling;
    while (sibling?.classList.contains("dcg-mq-cursor")) {
      sibling = sibling.nextElementSibling;
    }
    const parent = this.domNode.parentElement;
    if (!sibling && parent && isSelection(parent)) {
      sibling = parent.nextElementSibling;
    }
    if (sibling) {
      return new MqNodeViaDom(this.mq, sibling);
    }
    return undefined;
  }

  prevSibling(): MqNodeViaDom | undefined {
    let sibling = this.domNode.previousElementSibling;
    while (sibling?.classList.contains("dcg-mq-cursor")) {
      sibling = sibling.previousElementSibling;
    }
    const parent = this.domNode.parentElement;
    if (!sibling && parent && isSelection(parent)) {
      sibling = parent.previousElementSibling;
    }
    if (sibling) {
      return new MqNodeViaDom(this.mq, sibling);
    }
    return undefined;
  }

  siblingInDirection(dir: 1 | -1): MqNodeViaDom | undefined {
    return dir === -1 ? this.prevSibling() : this.nextSibling();
  }

  latex() {
    const span = this.mq.domNodeToSpan(this.domNode);
    if (!span) return "";
    return span.latex.slice(span.startIndex, span.endIndex);
  }
}

/**
 * Selections are also in the HTML tree, but we want to avoid them
 * for MQ tree traversal methods like .nextSibling().
 */
function isSelection(el: Element) {
  return el.classList.contains("dcg-mq-selection");
}
