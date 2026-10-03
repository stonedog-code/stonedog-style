import { test, expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import { FieldForm, FieldHandRolled } from "./StyledField.harness";

/**
 * StyledField in a real browser: the accessible names and descriptions as the
 * browser computes them, the error region's paint, and the checkbox row's
 * target.
 *
 * `describedText` resolves `aria-describedby` to the text a screen reader
 * reads. It is proved against `FieldHandRolled` first — a field with a
 * visible, unwired error — so its passes on the real component are a
 * measurement rather than an echo.
 */
const describedText = (locator: Locator) =>
  locator.evaluate((el) =>
    (el.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "")
      .join(" | "),
  );

test.describe("the description check bites", () => {
  test("rejects a hand-rolled field whose visible error is not wired", async ({ mount }) => {
    const component = await mount(<FieldHandRolled />);
    const control = component.getByLabel("Notes");
    await expect(control).toHaveAttribute("aria-invalid", "true");
    await expect(component.getByRole("alert")).toHaveText("Notes are required.");
    expect(await describedText(control)).not.toContain("Notes are required.");
    await expect(control).not.toHaveAccessibleDescription(/Notes are required/);
  });
});

test.describe("names and descriptions", () => {
  test("every control is named by its visible label", async ({ mount }) => {
    const component = await mount(<FieldForm />);
    await expect(component.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(component.getByRole("textbox", { name: "Minutes" })).toBeVisible();
    await expect(component.getByRole("combobox", { name: /Country/ })).toBeVisible();
    await expect(component.getByRole("checkbox", { name: "Send me reminders" })).toBeVisible();
    await expect(component.getByRole("group", { name: /Billing cycle/ })).toBeVisible();
  });

  test("help is the description at rest; the error joins it on submit and leaves on clear", async ({
    mount,
  }) => {
    const component = await mount(<FieldForm />);
    const email = component.getByRole("textbox", { name: "Email" });
    await expect(email).toHaveAccessibleDescription("We send receipts here.");
    await expect(email).not.toHaveAttribute("aria-invalid");

    await component.getByRole("button", { name: "Save" }).click();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription(/We send receipts here\..*Enter an email address\./);
    await expect(component.getByRole("textbox", { name: "Minutes" })).toHaveAccessibleDescription(
      /Add the minutes\./,
    );
    await expect(component.getByRole("group", { name: /Billing cycle/ })).toHaveAccessibleDescription(
      /Choose a cycle\./,
    );

    await component.getByRole("button", { name: "Clear errors" }).click();
    await expect(email).toHaveAccessibleDescription("We send receipts here.");
    await expect(email).not.toHaveAttribute("aria-invalid");
  });

  test("required is announced by the control and shown on the label", async ({ mount }) => {
    const component = await mount(<FieldForm />);
    await expect(component.getByRole("textbox", { name: "Email" })).toHaveAttribute("required", "");
    await expect(component.getByRole("radiogroup")).toHaveAttribute("aria-required", "true");
    // The marker is visible text, hidden from the accessibility tree.
    const marker = component.locator("label[for=email] [aria-hidden=true]");
    await expect(marker).toHaveText("*");
    await expect(marker).toBeVisible();
  });
});

test.describe("the error region", () => {
  test("is mounted and takes no room before there is an error", async ({ mount }) => {
    const component = await mount(<FieldForm />);
    const region = component.locator("#email-error");
    await expect(region).toHaveAttribute("role", "alert");
    await expect(region).toBeEmpty();
    const box = await region.evaluate((el) => {
      const s = getComputedStyle(el);
      return { height: el.getBoundingClientRect().height, marginTop: parseFloat(s.marginTop) };
    });
    expect(box.height).toBe(0);
    expect(box.marginTop).toBe(0);
  });

  test("paints the error colour token, with a glyph as well as colour", async ({ mount }) => {
    const component = await mount(<FieldForm />);
    await component.getByRole("button", { name: "Save" }).click();
    const region = component.locator("#email-error");
    await expect(region).toContainText("⚠");
    const colours = await region.evaluate((el) => {
      const probe = el.ownerDocument.createElement("span");
      probe.style.color = "var(--colors-text-error)";
      el.ownerDocument.body.appendChild(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return { actual: getComputedStyle(el).color, expected };
    });
    expect(colours.actual).toBe(colours.expected);
    expect(colours.actual).not.toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("targets", () => {
  test("the checkbox row is a 48px target and its label toggles the box", async ({ mount }) => {
    const component = await mount(<FieldForm />);
    const box = component.getByRole("checkbox", { name: "Send me reminders" });
    const row = box.locator("xpath=..");
    const rect = await row.boundingBox();
    expect(rect!.height).toBeGreaterThanOrEqual(48);
    await component.getByText("Send me reminders").click();
    await expect(box).toBeChecked();
  });

  test("nothing overflows its column at this viewport", async ({ mount }) => {
    const component = await mount(<FieldForm />);
    const overflow = await component.evaluate((form) =>
      Array.from(form.querySelectorAll<HTMLElement>("*"))
        .filter((el) => el.getBoundingClientRect().right > form.getBoundingClientRect().right + 1)
        .map((el) => el.tagName + (el.id ? `#${el.id}` : "")),
    );
    expect(overflow).toEqual([]);
  });
});
