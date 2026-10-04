import { test, expect } from "@playwright/experimental-ct-react";
import {
  ConfirmRemove,
  ConfirmBesideAlert,
  ConfirmWithBody,
  ConfirmWithTextBody,
  ConfirmStepUpModes,
  ConfirmRefused,
} from "./StyledInlineConfirm.harness";

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

/**
 * NEH-1887 — after a refused `onConfirm`, where does focus go?
 *
 * With a step-up field: the CODE FIELD, on any rejection (0.37.0). Before it,
 * focus always went to Confirm, so a keyboard reader told their code was wrong
 * had to Shift+Tab back to the field to fix it. Keyed on `stepUp` rather than
 * on `stepUpError` — see the comment at the `catch` in the component.
 * Without a step-up, Confirm, as before. Only this tier can prove where focus
 * lands (NEH-1860 measured a jsdom focus test passing on broken code), so
 * there is deliberately no jsdom twin.
 */
test.describe("focus after a refused confirm", () => {
  test("a refused step-up code puts focus back on the code field, with the host's verdict", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ConfirmRefused stepUp withError />);
    await component.getByRole("button", { name: "Remove organisation" }).click();
    const code = component.getByRole("textbox", { name: /Verification code/ });
    await code.fill("000000");
    // Activated from Confirm itself, so the focus has to MOVE to pass.
    const confirm = component.getByRole("button", { name: "Remove Acme Ltd" });
    await confirm.focus();
    await page.keyboard.press("Enter");
    await expect(component.getByTestId("attempts")).toHaveText("1");
    await expect(code).toHaveAttribute("aria-invalid", "true");
    await expect(code).toHaveAccessibleDescription(/did not match/);
    await expect(code).toBeFocused();
    // And it stays there rather than being yanked by a late frame.
    await page.waitForTimeout(100);
    await expect(code).toBeFocused();
  });

  test("any refusal with a step-up field refocuses the code, even without a field verdict", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ConfirmRefused stepUp />);
    await component.getByRole("button", { name: "Remove organisation" }).click();
    const code = component.getByRole("textbox", { name: /Verification code/ });
    await code.fill("123456");
    await component.getByRole("button", { name: "Remove Acme Ltd" }).click();
    await expect(component.getByTestId("attempts")).toHaveText("1");
    await expect(code).toBeFocused();
    // Enter from the field retries, so a transient failure is one key away.
    await page.keyboard.press("Enter");
    await expect(component.getByTestId("attempts")).toHaveText("2");
    await expect(code).toBeFocused();
  });

  test("without a step-up, a refusal returns focus to Confirm — unchanged", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ConfirmRefused />);
    await component.getByRole("button", { name: "Remove organisation" }).click();
    const confirm = component.getByRole("button", { name: "Remove Acme Ltd" });
    await confirm.click();
    await expect(component.getByTestId("attempts")).toHaveText("1");
    await expect(confirm).toBeFocused();
    const active = await page.evaluate(() => document.activeElement?.tagName);
    expect(active).toBe("BUTTON");
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

test.describe("body slot (NEH-1852)", () => {
  test("open lands on the body's first control; the values reach the confirm handler", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ConfirmWithBody />);
    const trigger = component.getByRole("button", { name: "Call off meeting" }).first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const panel = component.getByRole("group", { name: /Call off the March board meeting\?/ });
    await expect(panel).toBeVisible();
    const reason = panel.getByRole("textbox", { name: "Reason" });
    await expect(reason).toBeFocused();

    // The body sits between the prompt and the actions, in reading order.
    const order = await panel.evaluate((el) => {
      const text = el.textContent ?? "";
      return [
        text.indexOf("Call off the March"),
        text.indexOf("Reason"),
        text.indexOf("Cancel"),
      ];
    });
    expect(order[0]!).toBeLessThan(order[1]!);
    expect(order[1]!).toBeLessThan(order[2]!);

    await page.keyboard.type("Quorum not met");
    await page.keyboard.press("Tab");
    await expect(panel.getByRole("checkbox", { name: "Email the board" })).toBeFocused();
    await page.keyboard.press("Space");
    await panel.getByRole("button", { name: "Call off meeting" }).click();
    await expect(component.getByTestId("log")).toHaveText("confirmed:Quorum not met:notify");
    await expect(trigger).toBeFocused();
  });

  test("Escape from inside the body returns focus to the trigger", async ({ mount, page }) => {
    const component = await mount(<ConfirmWithBody />);
    const trigger = component.getByTestId("inline-confirm-trigger");
    await trigger.click();
    await expect(component.getByRole("textbox", { name: "Reason" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(component.getByTestId("inline-confirm-panel")).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(component.getByTestId("log")).toHaveText("cancelled");
  });

  test("a body with nothing focusable leaves focus on Cancel, as before", async ({ mount }) => {
    const component = await mount(<ConfirmWithTextBody />);
    await component.getByRole("button", { name: "Archive" }).click();
    await expect(component.getByText("Archived filings stay searchable")).toBeVisible();
    await expect(component.getByRole("button", { name: "Cancel" })).toBeFocused();
  });

  test("with a body AND a step-up, the body leads and an empty code refocuses the CODE field", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ConfirmWithBody stepUp />);
    await component.getByTestId("inline-confirm-trigger").click();
    await expect(component.getByRole("textbox", { name: "Reason" })).toBeFocused();
    await component.getByTestId("inline-confirm-confirm").click();
    const code = component.getByRole("textbox", { name: /Verification code/ });
    await expect(code).toBeFocused();
    await expect(code).toHaveAttribute("aria-invalid", "true");
    await page.keyboard.type("A1B2-C3D4");
    await page.keyboard.press("Enter");
    await expect(component.getByTestId("log")).toHaveText("confirmed::quiet:A1B2-C3D4");
  });
});

test.describe("step-up keyboard (NEH-1858)", () => {
  test("defaults to a text keyboard; numeric and autocomplete are the caller's to choose", async ({
    mount,
  }) => {
    const component = await mount(<ConfirmStepUpModes />);
    const read = async (id: string, trigger: string, field: RegExp) => {
      await component.getByRole("button", { name: trigger }).click();
      const input = component.getByTestId(id).getByRole("textbox", { name: field });
      await expect(input).toBeFocused();
      return {
        inputMode: await input.evaluate((el) => (el as HTMLInputElement).inputMode),
        autocomplete: await input.getAttribute("autocomplete"),
      };
    };
    expect(await read("default", "Default step-up", /Code, recovery code or password/)).toEqual({
      inputMode: "text",
      autocomplete: "one-time-code",
    });
    expect(await read("numeric", "Numeric step-up", /Six-digit code/)).toEqual({
      inputMode: "numeric",
      autocomplete: "one-time-code",
    });
    expect(await read("password", "Password step-up", /Password/)).toEqual({
      inputMode: "text",
      autocomplete: "current-password",
    });
  });
});
