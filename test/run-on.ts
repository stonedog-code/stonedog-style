/**
 * Find pairs of sibling elements that render as one run of text.
 *
 * jsdom has no layout engine, so it cannot say where boxes land, and
 * `textContent` cannot see a run-on at all: it is "Average182.7 points" before
 * a box-model fix and after it. What jsdom CAN answer is the computed
 * `display` of each element, from the UA defaults plus inline style. That is
 * enough to decide the one question that matters here:
 *
 * > Are two adjacent siblings both inline, with no text between them, inside
 * > a parent that does not blockify its children?
 *
 * Deliberately conservative in the direction of flagging. A flex or grid
 * parent blockifies its items, so a pair inside one is never reported. A
 * whitespace-only text node between the siblings DOES count as a separator,
 * because it renders as a space.
 *
 * This asks about what jsdom can see: inline style and UA defaults. A Panda
 * class that sets `display` is invisible to it, which makes this a test helper
 * for components that write their layout inline, not a general lint.
 */

export interface RunOnPair {
  parent: Element;
  first: Element;
  second: Element;
}

const INLINE = new Set(["", "inline", "inline-block"]);
const BLOCKIFYING_PARENT = new Set(["flex", "inline-flex", "grid", "inline-grid"]);

function display(el: Element): string {
  return el.ownerDocument.defaultView!.getComputedStyle(el).display;
}

export function findRunOnPairs(root: Element): RunOnPair[] {
  const pairs: RunOnPair[] = [];
  const walk = (parent: Element) => {
    const parentBlockifies = BLOCKIFYING_PARENT.has(display(parent));
    let previous: Element | null = null;
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === node.TEXT_NODE) {
        // Any text at all, whitespace included, renders between the two.
        if ((node.textContent ?? "").length > 0) previous = null;
        continue;
      }
      if (node.nodeType !== node.ELEMENT_NODE) continue;
      const el = node as Element;
      if (
        previous &&
        !parentBlockifies &&
        INLINE.has(display(previous)) &&
        INLINE.has(display(el)) &&
        (previous.textContent ?? "").length > 0 &&
        (el.textContent ?? "").length > 0
      ) {
        pairs.push({ parent, first: previous, second: el });
      }
      previous = el;
      walk(el);
    }
  };
  walk(root);
  return pairs;
}
