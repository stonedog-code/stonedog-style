/**
 * A hover tooltip must never outlive the pointer that opened it (NEH-818).
 *
 * ## The defect, measured rather than assumed
 *
 * Pressing a tooltipped button left its tooltip on the page permanently —
 * `opacity: 1`, `pointer-events: auto`, `z-index: 200000`, not inert. At phone
 * width it landed over the form the press had just opened and ate clicks on
 * it, with no error and no visible reason: the control simply did not respond.
 * Only a reload cleared it.
 *
 * The cause is a **leaked timer**, and it is worth stating precisely because
 * the two obvious readings are both wrong. Instrumenting the trigger's own
 * events through one press gave:
 *
 *     trigger:mouseenter@23287   show() -> timeoutRef = A
 *     trigger:focus@23287        show() -> timeoutRef = B   <- A orphaned
 *     trigger:mouseleave@23297   hide() -> clearTimeout(B) only
 *                                timer A fires -> setVisible(true)
 *
 * A press both hovers and focuses the trigger, ~0ms apart, so `show()` ran
 * twice and the second assignment dropped the first timer's id on the floor.
 * `hide()` could then cancel only the later one. The orphan opened a tooltip
 * that nothing could close: `blur` never comes (the press left focus on the
 * button) and `mouseleave` has already been and gone.
 *
 * **Not** "the trigger unmounts and the tooltip never gets a close signal",
 * which is what the issue was filed as — that case works, and is pinned below
 * so nobody fixes it twice. **Not** "the departure is processed while
 * `visible` is still false, so nothing calls `hide()`" either: the event log
 * above shows `mouseleave` arriving and `hide()` running. Both readings send
 * you to a different file.
 *
 * ## Why this tier
 *
 * The claim is that a control UNDERNEATH receives a click. jsdom cannot answer
 * it — no layout engine, so it cannot know two elements overlap, and a
 * synthetic `click()` fires the target's handler regardless of what is painted
 * over it. Every "is it hidden?" assertion passes against this bug: the
 * tooltip is a live, opaque, correctly-styled element that is simply in the
 * way. The ordering half of the defect is equally invisible there, because
 * jsdom dispatches no `mouseleave` of its own.
 */
import { test, expect } from "@playwright/experimental-ct-react";
import type { Page } from "@playwright/test";
import TooltipOrphan, { TooltipInsideIconButton } from "./StyledTooltip.harness";

/**
 * The human sequence: press the button, then take the pointer away.
 *
 * Deliberately does NOT wait for the tooltip before pressing. Waiting measures
 * a different case, and the collision between the hover timer and the focus
 * timer is the defect.
 */
async function pressThenLeave(page: Page) {
  await page.getByTestId("quicklaunch").click();
  await expect(page.getByTestId("form-dialog")).toBeVisible();
  await page.mouse.move(0, 0);
  // Well past the 120ms open delay, so a tooltip that is going to appear has
  // appeared. Without this the spec could pass by being early, which is the
  // failure mode that makes a timing test worthless.
  await page.waitForTimeout(600);
}

test.describe("a tooltip whose trigger is pressed", () => {
  test("is torn down once the pointer has left", async ({ mount, page }) => {
    await mount(<TooltipOrphan />);
    await pressThenLeave(page);

    await expect(page.locator('[role="tooltip"]')).toHaveCount(0);
  });

  test("does not swallow a click on the dialog underneath", async ({ mount, page }) => {
    await mount(<TooltipOrphan />);
    await pressThenLeave(page);

    // Where the tooltip WAS — the point a stranded one would be intercepting.
    // Measured from the dialog rather than from the tooltip, which by now
    // should not exist: the click has to land somewhere a person would aim,
    // and the whole dialog body is the control.
    const box = await page.getByTestId("form-control").boundingBox();
    expect(box).not.toBeNull();

    // `page.mouse.click`, not `locator.click()` — a locator click retries
    // actionability for its whole timeout and then reports an interception,
    // which describes the symptom. Clicking the coordinate asks the question
    // the user is asking and gets a straight answer.
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

    // The whole defect, in one assertion: the control underneath is the thing
    // that ran. Before the fix this stayed "nothing" — the stranded tooltip
    // took the click, and nothing happened.
    await expect(page.getByTestId("landed-on")).toHaveText("form");
  });

  test("closes on Escape, without the pointer or focus moving", async ({ mount, page }) => {
    await mount(<TooltipOrphan />);

    // Open it the ordinary way and let it settle, so this measures dismissal
    // rather than the race above.
    await page.getByTestId("quicklaunch").hover();
    await expect(page.locator('[role="tooltip"]')).toHaveCount(1);

    await page.keyboard.press("Escape");

    // WCAG 2.2 1.4.13 Dismissible. Hover mode had no keyboard dismissal at
    // all before NEH-818 — a reader whose pointer was parked on the trigger
    // had no way to clear the text it covered.
    await expect(page.locator('[role="tooltip"]')).toHaveCount(0);
  });

  test("stays open while the pointer is on the tooltip itself", async ({ mount, page }) => {
    await mount(<TooltipOrphan />);

    await page.getByTestId("quicklaunch").hover();
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toHaveCount(1);

    const box = await tooltip.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(300);

    // WCAG 2.2 1.4.13 Hoverable, and the reason the document-level
    // `pointermove` dismissal excludes the tooltip's own subtree. Pinned in
    // BOTH directions on purpose: a dismissal that closed on any movement
    // would pass every other test in this file while making the explanation
    // unreadable for anyone who needs to move onto it — a magnifier user, or
    // anyone selecting the text.
    await expect(tooltip).toHaveCount(1);
  });

  test("survives an unrelated mouse move while the trigger holds focus", async ({
    mount,
    page,
  }) => {
    await mount(<TooltipOrphan />);

    // Keyboard reveal, with the pointer parked far away and never on the
    // trigger.
    await page.mouse.move(0, 0);
    await page.getByTestId("quicklaunch").focus();
    await expect(page.locator('[role="tooltip"]')).toHaveCount(1);

    await page.mouse.move(5, 5);
    await page.mouse.move(60, 40);
    await page.waitForTimeout(300);

    // WCAG 2.2 1.4.13 Persistent. The document-level `pointermove` dismissal
    // that closes a stranded tooltip must not reach a focus-revealed one —
    // otherwise the fix for NEH-818 takes the explanation away from a reader
    // who never touched the mouse, which is a worse bug than the one it fixes.
    await expect(page.locator('[role="tooltip"]')).toHaveCount(1);
  });

  test("closes cleanly when the trigger unmounts, as it always did", async ({ mount, page }) => {
    // NEH-818's stated premise, pinned as the working case it is. React tears
    // the portal down with the component, so an unmounting trigger was never
    // the mechanism — and a fix aimed at it would have changed nothing while
    // looking entirely reasonable in review.
    await mount(<TooltipOrphan unmountTriggerOnPress />);
    await pressThenLeave(page);

    await expect(page.locator('[role="tooltip"]')).toHaveCount(0);
  });
});

/**
 * Click mode inside an icon button (NEH-965).
 *
 * The unit tier already pins the DOM structure — no `<button>` inside a
 * `<button>`, and the control still present and still named. What it cannot
 * pin is whether the control that was moved out is a control anyone can
 * actually use: jsdom reports every box as zero-sized, so "the help is
 * reachable on a device that cannot hover" is unanswerable there. A control
 * rendered under the button, off the edge of the layout, or at 6px square
 * would pass every assertion in the jest suite.
 *
 * Measured against the pre-fix component: the control rendered INSIDE the
 * button, so `button button` found one and a press on "?" also fired the
 * button's own action.
 */
test.describe("a click-mode tooltip inside an icon button", () => {
  test("renders no button inside a button", async ({ mount, page }) => {
    await mount(<TooltipInsideIconButton />);
    await expect(page.getByRole("button", { name: "Help: Expand" })).toBeVisible();

    // The input-set size next to the assertion: two buttons is what a correct
    // render has, and "none nested" over an empty page would pass too.
    expect(await page.locator("button").count()).toBe(2);
    expect(await page.locator("button button").count()).toBe(0);
  });

  test("keeps the moved control at the 48x48 tap-target floor", async ({ mount, page }) => {
    await mount(<TooltipInsideIconButton />);
    const box = (await page.getByRole("button", { name: "Help: Expand" }).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
  });

  test("sits beside the button rather than on top of it", async ({ mount, page }) => {
    // Moving the control out of the button is only a fix if it lands somewhere
    // a finger can reach it without hitting the button instead. Overlap is the
    // failure mode a portal positioned over the ancestor would have.
    await mount(<TooltipInsideIconButton />);
    const button = (await page.getByTestId("icon-button").boundingBox())!;
    const help = (await page.getByRole("button", { name: "Help: Expand" }).boundingBox())!;

    const overlapsHorizontally =
      help.x < button.x + button.width && button.x < help.x + help.width;
    const overlapsVertically =
      help.y < button.y + button.height && button.y < help.y + help.height;
    expect(overlapsHorizontally && overlapsVertically).toBe(false);
  });

  test("explains without also doing the thing being explained", async ({ mount, page }) => {
    // The whole point on a device that cannot hover: tapping the button
    // activates it, so the explanation needs a target of its own — and that
    // target must not activate the button. A React portal bubbles through the
    // React tree, so without stopPropagation it would.
    await mount(<TooltipInsideIconButton />);
    await page.getByRole("button", { name: "Help: Expand" }).click();

    await expect(page.locator('[role="tooltip"]')).toHaveText(
      "Click to expand to full screen",
    );
    await expect(page.getByTestId("pressed")).toHaveText("0");

    // And the button still works on its own.
    await page.getByTestId("icon-button").click();
    await expect(page.getByTestId("pressed")).toHaveText("1");
  });
});
