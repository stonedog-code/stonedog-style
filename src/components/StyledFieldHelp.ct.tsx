import { test, expect } from "@playwright/experimental-ct-react";
import {
  ExplainedForm,
  HelpBesideText,
  HelpOnPage,
  LongHelp,
  SizedHelp,
  SmallestProfileHelp,
} from "./StyledFieldHelp.harness";

/**
 * The words the harness renders, repeated rather than imported.
 *
 * Playwright's component-test transform rewrites every import from a module it
 * treats as a component source, and a plain value exported alongside those
 * components comes back declared twice — the suite then fails to load at all
 * with `Identifier 'ExplainedForm' has already been declared`, which reads like
 * a duplicate import and is not one. A drifting copy cannot go unnoticed here:
 * every assertion below compares it against what was actually rendered.
 */
const HELP_TEXT = "Milligrams per tablet, as printed on the bottle.";

/**
 * What a real browser can answer about inline help and jsdom cannot: where the
 * Tab key actually goes, what the accessibility tree actually says, and what
 * size the text actually renders at.
 *
 * Runs at all four viewports. The wrapping assertion is the reason — a line of
 * help is comfortable at 1920 and is the thing that pushes a control off the
 * screen at 375, which is the width this audience is most likely to be holding.
 *
 * ## The two guards, and the failure each was planted to prove
 *
 * - **zero tab stops** — with `tabIndex={0}` on the rendered element, the
 *   traversal test below fails: Tab lands inside `[data-field-help]`.
 * - **the association** — with the `aria-describedby` effect removed, the
 *   accessible-description tests fail with an empty description.
 *
 * Both were run in that state before this file was committed. A guard that has
 * only ever been watched passing has been run, not tested.
 */

/** Everything the browser puts in the tab sequence, plus explicit stops. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

test.describe("StyledFieldHelp — it costs the keyboard nothing", () => {
  test("two explained controls are still exactly two tab stops", async ({
    mount,
    page,
  }) => {
    // The whole reason this component exists. The pattern it replaces put a
    // `<button>` beside every explained control, so this form would have been
    // four stops, and a screen with twenty helps would have been forty.
    await mount(<ExplainedForm />);

    // Tab all the way round the document rather than a fixed number of times.
    // The sequence wraps — after the last control the browser hands focus to
    // its own chrome and then back to the first control — so a fixed count
    // reports the wrap as an extra stop. Collecting until an id repeats asks
    // the question that was meant: which elements are IN the cycle.
    const order: string[] = [];
    let everLandedInHelp = false;
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        return {
          id: el.id,
          insideHelp: el.closest("[data-field-help]") !== null,
        };
      });
      if (!stop) continue;
      if (stop.insideHelp) everLandedInHelp = true;
      if (order.includes(stop.id)) break;
      order.push(stop.id);
    }

    // Reported as ids rather than as a count alone, so a failure says WHERE the
    // extra stop was rather than only that there was one.
    expect(order).toEqual(["dose", "unit"]);
    expect(everLandedInHelp).toBe(false);
  });

  test("the help element contains nothing focusable, at any viewport", async ({
    mount,
  }) => {
    const component = await mount(<ExplainedForm />);
    const helps = component.locator("[data-field-help]");
    await expect(helps).toHaveCount(2);

    const focusable = await helps.evaluateAll(
      (nodes, selector) =>
        nodes.reduce(
          (total, node) => total + node.querySelectorAll(selector).length,
          0,
        ),
      FOCUSABLE,
    );
    expect(focusable).toBe(0);
  });

  test("the help element is not itself focusable", async ({ mount }) => {
    const component = await mount(<HelpOnPage />);
    const help = component.locator("[data-field-help]");

    // `focus()` on a non-focusable element is a no-op, so the active element
    // stays where it was. This asks the browser rather than reading an
    // attribute, which is the only way to catch a `contenteditable` or a
    // focusable role sneaking in later.
    const tookFocus = await help.evaluate((el) => {
      (el as HTMLElement).focus();
      return document.activeElement === el;
    });
    expect(tookFocus).toBe(false);
  });
});

test.describe("StyledFieldHelp — the browser calls it the field's description", () => {
  test("the control's accessible description is the help text", async ({
    mount,
    page,
  }) => {
    // The strong form of the wiring assertion: this is the browser's own
    // accessible-description computation, which is what a screen reader reads.
    // An `aria-describedby` pointing at nothing would pass a DOM check and fail
    // here.
    await mount(<HelpOnPage />);
    await expect(page.locator("#dose")).toHaveAccessibleDescription(HELP_TEXT);
  });

  test("the label is still the name, not the description", async ({
    mount,
    page,
  }) => {
    // Help folded into the accessible NAME would break voice control (WCAG
    // 2.5.3): the user says "Dose" and nothing matches a control called
    // "Dose Milligrams per tablet…".
    await mount(<HelpOnPage />);
    await expect(page.locator("#dose")).toHaveAccessibleName("Dose");
  });

  test("every control in a form gets its own description", async ({
    mount,
    page,
  }) => {
    // Two fields, two ids, no crossing over — the failure a single shared id
    // would produce.
    await mount(<ExplainedForm />);
    await expect(page.locator("#dose")).toHaveAccessibleDescription(HELP_TEXT);
    await expect(page.locator("#unit")).toHaveAccessibleDescription(HELP_TEXT);
    await expect(page.locator("#dose")).toHaveAttribute(
      "aria-describedby",
      "dose-help",
    );
    await expect(page.locator("#unit")).toHaveAttribute(
      "aria-describedby",
      "unit-help",
    );
  });
});

test.describe("StyledFieldHelp — visible with no gesture at all", () => {
  test("the words are on screen before anything is touched", async ({
    mount,
  }) => {
    // No hover, no focus, no click, no preference. The tooltip this replaces
    // required a pointer gesture that a touch device cannot make at all.
    const component = await mount(<HelpOnPage />);
    await expect(component.locator("[data-field-help]")).toBeVisible();
    await expect(component.locator("[data-field-help]")).toHaveText(HELP_TEXT);
  });

  test("it is painted, not merely present", async ({ mount }) => {
    // `toBeVisible` tolerates `opacity: 0`. A tooltip-shaped implementation
    // would sit at zero opacity until hovered and pass everything above.
    const component = await mount(<HelpOnPage />);
    const painted = await component
      .locator("[data-field-help]")
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          opacity: Number(s.opacity),
          visibility: s.visibility,
          height: el.getBoundingClientRect().height,
        };
      });
    expect(painted.opacity).toBe(1);
    expect(painted.visibility).toBe("visible");
    expect(painted.height).toBeGreaterThan(0);
  });
});

test.describe("StyledFieldHelp — where it sits and how big it is", () => {
  test("it sits below the label and above the control", async ({ mount }) => {
    // The order is the design. Help under the control is help the reader meets
    // after they have already answered.
    const component = await mount(<HelpOnPage />);
    const box = async (selector: string) => {
      const rect = await component.locator(selector).boundingBox();
      expect(rect).not.toBeNull();
      return rect!;
    };
    const label = await box("label");
    const help = await box("[data-field-help]");
    const control = await box("#dose");

    expect(help.y).toBeGreaterThanOrEqual(label.y + label.height);
    expect(control.y).toBeGreaterThanOrEqual(help.y + help.height);
  });

  test("it renders one tier below the text it explains", async ({ mount }) => {
    // jsdom cannot see this at all: every entry in the type scale is a `var()`
    // reference, which its CSS parser drops from the style attribute, so a
    // `toHaveStyle` on the size passes for every possible expectation.
    const component = await mount(<HelpBesideText />);
    const px = (testId: string) =>
      component
        .getByTestId(testId)
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    const help = await px("help");
    const body = await px("body");
    expect(help).toBeLessThan(body);
    // One tier, not a shrink into illegibility. The default scale steps
    // 1rem -> 0.875rem, so anything below ~80% means more than one step was
    // taken somewhere.
    expect(help / body).toBeGreaterThan(0.8);
  });

  test("at the smallest profile it stops shrinking instead of going below the scale", async ({
    mount,
  }) => {
    // The clamp in `stepDownFontSize`. The reader who has already turned the
    // text size all the way down is the one with the least room to spare, so
    // help matches the body text here rather than dropping under it.
    const component = await mount(<SmallestProfileHelp />);
    const px = (testId: string) =>
      component
        .getByTestId(testId)
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(await px("help")).toBe(await px("body"));
  });

  test("it follows the app-wide text size", async ({ mount }) => {
    // A reader who raises their text size is the reader who most needs the
    // help, so it must move with the setting rather than staying pinned.
    const component = await mount(<SizedHelp />);
    const px = (testId: string) =>
      component
        .getByTestId(testId)
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(await px("help-xl")).toBeGreaterThan(await px("help-sm"));
  });

  test("a long line wraps instead of pushing the control off screen", async ({
    mount,
    page,
  }) => {
    // Fails first at 375, which is why this suite runs at four widths. Inline
    // help is text the reader did not ask for in a space they did not budget
    // for, so it has to wrap.
    const component = await mount(<LongHelp />);
    const help = await component.locator("[data-field-help]").boundingBox();
    const viewport = page.viewportSize();
    expect(help).not.toBeNull();
    expect(help!.width).toBeLessThanOrEqual(viewport!.width);
    // And it did wrap: a single line at 375 would mean it overflowed instead.
    const lineHeight = await component
      .locator("[data-field-help]")
      .evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    if ((viewport?.width ?? 0) <= 375) {
      expect(help!.height).toBeGreaterThan(lineHeight);
    }
  });
});
