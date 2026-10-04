import { test, expect } from "@playwright/experimental-ct-react";
import { StackLists, StackListOverrides } from "./StyledStack.harness";

/**
 * NEH-1868 — `StyledStack`/`StyledVStack` honour `as`, in a real browser.
 *
 * Before 0.36.0 `StyledVStack` never read `as`, so `<StyledStack as="ul">`
 * rendered `<div as="ul">`: Chromium's accessibility tree had no list and
 * three orphaned list items. These assert the tree Playwright computes, then
 * that the stack is still a stack — the gap still separates the items and the
 * user-agent's bullets, indent and margin are gone unless the caller asks.
 */

const LIST_IDS = ["stack-ul", "stack-ol", "vstack-ul", "row-ul"] as const;

test("as=ul / as=ol render a list whose items are the children", async ({ mount }) => {
  const component = await mount(<StackLists />);
  for (const id of LIST_IDS) {
    const root = component.getByTestId(id);
    const tag = await root.evaluate((el) => el.tagName);
    expect(tag, id).toBe(id === "stack-ol" ? "OL" : "UL");
    expect(await root.getAttribute("as"), id).toBeNull();
    await expect(root, id).toHaveRole("list");
    await expect(root.getByRole("listitem"), id).toHaveCount(3);
  }
  // The page holds exactly the four lists — the div stack is not one.
  await expect(component.getByRole("list")).toHaveCount(4);
});

test("a list stack is still laid out by the stack: direction and gap apply", async ({
  mount,
}) => {
  const component = await mount(<StackLists />);
  for (const id of LIST_IDS) {
    const metrics = await component.getByTestId(id).evaluate((el) => {
      const s = getComputedStyle(el);
      const boxes = Array.from(el.children).map((c) => c.getBoundingClientRect());
      return {
        display: s.display,
        direction: s.flexDirection,
        gap: s.rowGap,
        boxes: boxes.map((b) => ({ x: b.x, y: b.y, w: b.width, h: b.height })),
      };
    });
    expect(metrics.display, id).toBe("flex");
    expect(metrics.gap, id).toBe("16px");
    const [a, b] = metrics.boxes;
    if (id === "row-ul") {
      expect(metrics.direction, id).toBe("row");
      expect(b!.x - (a!.x + a!.w), id).toBeCloseTo(16, 0);
    } else {
      expect(metrics.direction, id).toBe("column");
      expect(b!.y - (a!.y + a!.h), id).toBeCloseTo(16, 0);
    }
  }
});

test("a list stack draws no bullets, indent or margin the caller did not ask for", async ({
  mount,
}) => {
  const component = await mount(<StackLists />);
  for (const id of LIST_IDS) {
    const reset = await component.getByTestId(id).evaluate((el) => {
      const s = getComputedStyle(el);
      const item = getComputedStyle(el.children[0]!);
      return {
        listStyle: s.listStyleType,
        itemListStyle: item.listStyleType,
        paddingInlineStart: s.paddingInlineStart,
        marginTop: s.marginTop,
        marginBottom: s.marginBottom,
      };
    });
    expect(reset, id).toEqual({
      listStyle: "none",
      itemListStyle: "none",
      paddingInlineStart: "0px",
      marginTop: "0px",
      marginBottom: "0px",
    });
  }
});

test("a caller's spacing and list style beat the reset", async ({ mount }) => {
  const component = await mount(<StackListOverrides />);
  const read = (id: string) =>
    component.getByTestId(id).evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        mt: s.marginTop,
        pl: s.paddingLeft,
        pr: s.paddingRight,
        pt: s.paddingTop,
        listStyle: s.listStyleType,
      };
    });
  const spaced = await read("spaced");
  expect(spaced.mt).toBe("16px");
  expect(spaced.pl).toBe("16px");
  expect(spaced.pr).toBe("16px");
  expect(spaced.pt).toBe("0px");
  const padded = await read("padded");
  expect(padded.pl).toBe("16px");
  expect(padded.pt).toBe("16px");
  const numbered = await read("numbered");
  expect(numbered.listStyle).toBe("decimal");
});

test("a stack with no `as` is still a plain div — the default did not move", async ({
  mount,
}) => {
  const component = await mount(<StackLists />);
  const root = component.getByTestId("stack-div");
  expect(await root.evaluate((el) => el.tagName)).toBe("DIV");
  expect(await root.getAttribute("role")).toBeNull();
  const gap = await root.evaluate((el) => {
    const [a, b] = Array.from(el.children).map((c) => c.getBoundingClientRect());
    return b!.y - (a!.y + a!.height);
  });
  expect(gap).toBeCloseTo(16, 0);
});
