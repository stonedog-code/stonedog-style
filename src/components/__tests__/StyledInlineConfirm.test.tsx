import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StyledInlineConfirm from "../StyledInlineConfirm";

/**
 * StyledInlineConfirm — disclosure wiring and, above all, where focus goes.
 * Losing focus to <body> when the trigger was swapped out is the defect every
 * hand-rolled version shared, so each transition asserts the focused element.
 */

function setup(props: Partial<React.ComponentProps<typeof StyledInlineConfirm>> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const user = userEvent.setup();
  render(
    <StyledInlineConfirm
      triggerLabel="Delete account"
      prompt="Delete your account? This cannot be undone."
      confirmLabel="Delete my account"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return {
    user,
    onConfirm,
    onCancel,
    trigger: screen.getByTestId("inline-confirm-trigger"),
    panel: screen.getByTestId("inline-confirm-panel"),
  };
}

describe("StyledInlineConfirm — disclosure", () => {
  it("the trigger controls a hidden panel, collapsed", () => {
    const { trigger, panel } = setup();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", panel.id);
    expect(panel).not.toBeVisible();
  });

  it("the panel is a group named by its prompt", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(
      screen.getByRole("group", { name: "Delete your account? This cannot be undone." }),
    ).toBeVisible();
  });
});

describe("StyledInlineConfirm — focus", () => {
  it("moves INTO the panel on open — to Cancel, the first control", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("inline-confirm-cancel")).toHaveFocus();
  });

  it("a second Enter out of habit cancels rather than confirms", async () => {
    const { user, trigger, onConfirm, onCancel } = setup();
    trigger.focus();
    await user.keyboard("{Enter}{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Cancel closes and returns focus to the trigger, which never left the DOM", async () => {
    const { user, trigger, panel, onCancel } = setup();
    await user.click(trigger);
    await user.click(screen.getByTestId("inline-confirm-cancel"));
    expect(onCancel).toHaveBeenCalled();
    expect(panel).not.toBeVisible();
    expect(trigger).toHaveFocus();
  });

  it("Escape does the same", async () => {
    const { user, trigger, panel } = setup();
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(panel).not.toBeVisible();
    expect(trigger).toHaveFocus();
  });
});

describe("StyledInlineConfirm — confirming", () => {
  it("runs onConfirm, closes, and returns focus", async () => {
    const { user, trigger, onConfirm, panel } = setup();
    await user.click(trigger);
    await user.click(screen.getByTestId("inline-confirm-confirm"));
    expect(onConfirm).toHaveBeenCalledWith({});
    await waitFor(() => expect(panel).not.toBeVisible());
    expect(trigger).toHaveFocus();
  });

  it("stays open when onConfirm rejects, so the reader can retry or cancel", async () => {
    const { user, trigger, panel } = setup({
      onConfirm: () => Promise.reject(new Error("nope")),
    });
    await user.click(trigger);
    await user.click(screen.getByTestId("inline-confirm-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("inline-confirm-confirm")).not.toBeDisabled(),
    );
    expect(panel).toBeVisible();
  });

  it("marks Confirm destructive by default", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(screen.getByTestId("inline-confirm-confirm")).toHaveAttribute("data-tone", "destructive");
  });
});

describe("StyledInlineConfirm — step-up code", () => {
  const stepUp = { label: "Verification code", help: "From your authenticator app." };

  it("focuses the code field first, and it is a labelled, described one-time-code input", async () => {
    const { user, trigger } = setup({ stepUp });
    await user.click(trigger);
    const code = screen.getByRole("textbox", { name: /Verification code/ });
    expect(code).toHaveFocus();
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    expect(code).toBeRequired();
  });

  it("refuses an empty code with a message rather than a disabled button", async () => {
    const { user, trigger, onConfirm } = setup({ stepUp });
    await user.click(trigger);
    const confirm = screen.getByTestId("inline-confirm-confirm");
    expect(confirm).not.toBeDisabled();
    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    const code = screen.getByRole("textbox", { name: /Verification code/ });
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveFocus();
    expect(screen.getByText("Enter the code to continue.")).toBeInTheDocument();
  });

  it("passes the code to onConfirm", async () => {
    const { user, trigger, onConfirm } = setup({ stepUp });
    await user.click(trigger);
    await user.keyboard("123456");
    await user.click(screen.getByTestId("inline-confirm-confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ code: "123456" });
  });

  it("shows the host's verdict as the field's error", async () => {
    const { user, trigger } = setup({ stepUp, stepUpError: "That code did not match." });
    await user.click(trigger);
    const code = screen.getByRole("textbox", { name: /Verification code/ });
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code.getAttribute("aria-describedby")).toBeTruthy();
  });
});
