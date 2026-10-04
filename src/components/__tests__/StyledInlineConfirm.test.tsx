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

describe("StyledInlineConfirm — body slot (NEH-1852)", () => {
  function WithBody({
    onConfirm,
    ...props
  }: Partial<React.ComponentProps<typeof StyledInlineConfirm>>) {
    const [reason, setReason] = React.useState("");
    return (
      <StyledInlineConfirm
        triggerLabel="Call off"
        prompt="Call off the meeting?"
        {...props}
        onConfirm={(details) => onConfirm?.({ ...details, reason } as never)}
      >
        <label>
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </StyledInlineConfirm>
    );
  }

  it("renders the body between the prompt and the actions, inside the panel", async () => {
    const user = userEvent.setup();
    render(<WithBody onConfirm={jest.fn()} />);
    await user.click(screen.getByTestId("inline-confirm-trigger"));
    const panel = screen.getByTestId("inline-confirm-panel");
    const body = screen.getByTestId("inline-confirm-body");
    expect(panel).toContainElement(body);
    const prompt = screen.getByText("Call off the meeting?");
    const cancel = screen.getByTestId("inline-confirm-cancel");
    // DOCUMENT_POSITION_FOLLOWING === 4
    expect(prompt.compareDocumentPosition(body) & 4).toBeTruthy();
    expect(body.compareDocumentPosition(cancel) & 4).toBeTruthy();
  });

  it("the caller's own state is what the confirm handler reads", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(<WithBody onConfirm={onConfirm} />);
    await user.click(screen.getByTestId("inline-confirm-trigger"));
    await user.keyboard("No quorum");
    await user.click(screen.getByTestId("inline-confirm-confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ reason: "No quorum" });
  });

  it("renders no body wrapper when there are no children", () => {
    setup();
    expect(screen.queryByTestId("inline-confirm-body")).not.toBeInTheDocument();
  });

  it("an empty step-up code refocuses the code field, not the body's input", async () => {
    const user = userEvent.setup();
    render(<WithBody onConfirm={jest.fn()} stepUp={{ label: "Verification code" }} />);
    await user.click(screen.getByTestId("inline-confirm-trigger"));
    await user.click(screen.getByTestId("inline-confirm-confirm"));
    expect(screen.getByRole("textbox", { name: /Verification code/ })).toHaveFocus();
  });
});

describe("StyledInlineConfirm — step-up keyboard (NEH-1858)", () => {
  it("defaults to a text keyboard, so a recovery code or password can be typed", async () => {
    const { user, trigger } = setup({ stepUp: { label: "Code" } });
    await user.click(trigger);
    const code = screen.getByRole("textbox", { name: /Code/ });
    expect(code).toHaveAttribute("inputmode", "text");
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
  });

  it("takes inputMode and autoComplete from the caller", async () => {
    const { user, trigger } = setup({
      stepUp: { label: "Code", inputMode: "numeric", autoComplete: "current-password" },
    });
    await user.click(trigger);
    const code = screen.getByRole("textbox", { name: /Code/ });
    expect(code).toHaveAttribute("inputmode", "numeric");
    expect(code).toHaveAttribute("autocomplete", "current-password");
  });

  it("accepts letters — the code reaches onConfirm verbatim", async () => {
    const { user, trigger, onConfirm } = setup({ stepUp: { label: "Code" } });
    await user.click(trigger);
    await user.keyboard("ABCD-2345");
    await user.click(screen.getByTestId("inline-confirm-confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ code: "ABCD-2345" });
  });
});
