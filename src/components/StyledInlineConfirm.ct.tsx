import { test, expect } from "@playwright/experimental-ct-react";
import { ConfirmRemove, ConfirmBesideAlert } from "./StyledInlineConfirm.harness";

/**
 * StyledInlineConfirm in a real browser: where focus actually goes (jsdom's
 * focus model is a simulation), whether `hidden` beats the panel's flex base,
 * target sizes, and whether Confirm's destructive paint resolved to the same
 * pair `StyledAlert status="error"` paints.
 */

test.describe("focus", () => {
  test("open moves focus into the panel; Cancel and Escape bring it back to the trigger", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ConfirmRemove />);
    const trigger = component.getByRole("button", { name: "Remove organisation" });
    const panel = component.getByRole("group", { name: /Remove Acme Ltd\?/ });
    await expect(panel).toBeHidden();

    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(component.getByRole("button", { name: "Cancel" })).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(component.getByTestId("log")).toHaveText("cancelled,cancelled");
  });

  test("never drops focus to <body> on any transition", async ({ mount, page }) => {
    const component = await mount(<ConfirmRemove />);
    const trigger = component.getByRole("button", { name: "Remove organisation" });
    await trigger.click();
    await component.getByRole("button", { name: "Remove Acme Ltd" }).click();
    await expect(component.getByTestId("log")).toHaveText("confirmed");
    const active = await page.evaluate(() => document.activeElement?.tagName);
    expect(active).toBe("BUTTON");
    await expect(trigger).toBeFocused();
  });

  test("with a step-up code the field takes focus first and the code reaches onConfirm", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ConfirmRemove stepUp />);
    await component.getByRole("button", { name: "Remove organisation" }).click();
    const code = component.getByRole("textbox", { name: /Verification code/ });
    await expect(code).toBeFocused();
    await expect(code).toHaveAccessibleDescription(/authenticator/);
    await page.keyboard.press("Enter");
    await expect(code).toHaveAttribute("aria-invalid", "true");
    await expect(code).toHaveAccessibleDescription(/Enter the code to continue\./);
    await page.keyboard.type("123456");
    await page.keyboard.press("Enter");
    await expect(component.getByTestId("log")).toHaveText("confirmed:123456");
  });
});

test.describe("targets and paint", () => {
  test("trigger, Cancel and Confirm all clear 48px", async ({ mount }) => {
    const component = await mount(<ConfirmRemove />);
    await component.getByRole("button", { name: "Remove organisation" }).click();
    for (const name of ["Remove organisation", "Cancel", "Remove Acme Ltd"]) {
      const box = await component.getByRole("button", { name }).boundingBox();
      expect(box!.height, name).toBeGreaterThanOrEqual(48);
      expect(box!.width, name).toBeGreaterThanOrEqual(48);
    }
  });

  test("Confirm paints the error alert's pair — surface and text — and its label inherits it", async ({
    mount,
  }) => {
    const component = await mount(<ConfirmBesideAlert />);
    await component.getByRole("button", { name: "Delete", exact: true }).click();
    const confirm = component.getByRole("button", { name: "Delete it" });
    const alert = component.getByRole("alert");
    const paint = await confirm.evaluate((el) => {
      const s = getComputedStyle(el);
      // The element that HOLDS the text, not the button — see CLAUDE.md on a
      // wrapper defeating the recipe it sits in.
      const label = Array.from(el.querySelectorAll<HTMLElement>("*")).find((n) =>
        Array.from(n.childNodes).some((c) => c.nodeType === 3 && c.textContent?.trim()),
      )!;
      return { bg: s.backgroundColor, color: s.color, labelColor: getComputedStyle(label).color };
    });
    const reference = await alert.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, color: s.color };
    });
    expect(paint.bg).toBe(reference.bg);
    expect(paint.color).toBe(reference.color);
    expect(paint.labelColor).toBe(reference.color);
  });

  test("hover does not repaint Confirm into another pairing", async ({ mount }) => {
    const component = await mount(<ConfirmBesideAlert />);
    await component.getByRole("button", { name: "Delete", exact: true }).click();
    const confirm = component.getByRole("button", { name: "Delete it" });
    const rest = await confirm.evaluate((el) => getComputedStyle(el).backgroundColor);
    await confirm.hover();
    const hovered = await confirm.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, shadow: s.boxShadow };
    });
    expect(hovered.bg).toBe(rest);
    expect(hovered.shadow).not.toBe("none");
  });
});
