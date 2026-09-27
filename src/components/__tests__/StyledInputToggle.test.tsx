import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StyledInputToggle from "../StyledInputToggle";
import StyledFieldHelp, { fieldHelpId } from "../StyledFieldHelp";

describe("StyledInputToggle", () => {
  it("is a switch", () => {
    render(<StyledInputToggle value={false} onChange={() => {}} label="Notifications" />);
    expect(screen.getByRole("switch", { name: "Notifications" })).toBeInTheDocument();
  });

  it("is a real button, not a div wearing a role", () => {
    // The platform then owns focus, activation and disabled semantics — and
    // gets right the cases hand-rolled key handling misses, like activating on
    // key-up rather than key-down.
    render(<StyledInputToggle value={false} onChange={() => {}} label="X" />);
    expect(screen.getByRole("switch").tagName).toBe("BUTTON");
  });

  it("is type=button, so it never submits a surrounding form", () => {
    render(<StyledInputToggle value={false} onChange={() => {}} label="X" />);
    expect(screen.getByRole("switch")).toHaveAttribute("type", "button");
  });

  it("reports its state", () => {
    const { rerender } = render(
      <StyledInputToggle value={false} onChange={() => {}} label="X" />,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    rerender(<StyledInputToggle value onChange={() => {}} label="X" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("toggles on click", () => {
    const onChange = jest.fn();
    render(<StyledInputToggle value={false} onChange={onChange} label="X" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles back", () => {
    const onChange = jest.fn();
    render(<StyledInputToggle value onChange={onChange} label="X" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  describe("disabled", () => {
    it("is disabled natively, not by an aria attribute alone", () => {
      render(<StyledInputToggle value={false} onChange={() => {}} label="X" disabled />);
      expect(screen.getByRole("switch")).toBeDisabled();
    });

    it("does not fire", () => {
      const onChange = jest.fn();
      render(<StyledInputToggle value={false} onChange={onChange} label="X" disabled />);
      fireEvent.click(screen.getByRole("switch"));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("strikes the icon through, hidden from assistive tech", () => {
      // Decorative: the switch already announces disabled itself, so an
      // announced strike would be noise.
      render(
        <StyledInputToggle
          value={false}
          onChange={() => {}}
          label="X"
          disabled
          iconOff={<svg />}
        />,
      );
      expect(screen.getByTestId("toggle-strike")).toHaveAttribute("aria-hidden", "true");
    });

    it("draws no strike when there is no icon to strike", () => {
      render(<StyledInputToggle value={false} onChange={() => {}} label="X" disabled />);
      expect(screen.queryByTestId("toggle-strike")).toBeNull();
    });
  });

  describe("icons", () => {
    it("shows the on icon when on", () => {
      render(
        <StyledInputToggle
          value
          onChange={() => {}}
          label="X"
          iconOn={<svg data-testid="on" />}
          iconOff={<svg data-testid="off" />}
        />,
      );
      expect(screen.getByTestId("on")).toBeInTheDocument();
      expect(screen.queryByTestId("off")).toBeNull();
    });

    it("shows the off icon when off", () => {
      render(
        <StyledInputToggle
          value={false}
          onChange={() => {}}
          label="X"
          iconOn={<svg data-testid="on" />}
          iconOff={<svg data-testid="off" />}
        />,
      );
      expect(screen.getByTestId("off")).toBeInTheDocument();
    });

    it("renders without either", () => {
      render(<StyledInputToggle value={false} onChange={() => {}} label="X" />);
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });
  });

  describe("accessible name", () => {
    it("falls back to a string tooltip", () => {
      render(<StyledInputToggle value={false} onChange={() => {}} tooltip="Mute alerts" />);
      expect(screen.getByRole("switch", { name: "Mute alerts" })).toBeInTheDocument();
    });

    it("prefers an explicit label over the tooltip", () => {
      render(
        <StyledInputToggle
          value={false}
          onChange={() => {}}
          tooltip="Mute alerts"
          label="Alert sound"
        />,
      );
      expect(screen.getByRole("switch", { name: "Alert sound" })).toBeInTheDocument();
    });

    it("is unnamed when a node tooltip is the only candidate", () => {
      // Pinning the gap rather than pretending it is handled: a node cannot be
      // flattened into a name, so a call site passing only a node tooltip must
      // pass `label` too. The old component had the same hole and no test.
      render(
        <StyledInputToggle value={false} onChange={() => {}} tooltip={<span>Mute</span>} />,
      );
      expect(screen.getByRole("switch")).not.toHaveAttribute("aria-label");
    });
  });

  it("puts a caller's test id on the switch itself", () => {
    // So `click(getByTestId(...))` actually toggles. On the container it would
    // silently do nothing — and that reads as a broken component rather than a
    // selector aimed one level too high.
    const onChange = jest.fn();
    render(
      <StyledInputToggle
        value={false}
        onChange={onChange}
        label="X"
        data-testid="my-toggle"
      />,
    );
    fireEvent.click(screen.getByTestId("my-toggle"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  describe("being described, not just named", () => {
    it("writes ariaDescribedBy onto the SWITCH", () => {
      // The defect: there was no prop at all, so a named switch could never be
      // described. Asserted on the element with role=switch rather than on any
      // element in the tree — the wrapper carrying it is exactly the bug.
      render(
        <StyledInputToggle
          value={false}
          onChange={() => {}}
          label="Notifications"
          ariaDescribedBy="notify-help"
        />,
      );
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-describedby",
        "notify-help",
      );
    });

    it("takes several ids, as the attribute does", () => {
      render(
        <StyledInputToggle
          value={false}
          onChange={() => {}}
          label="X"
          ariaDescribedBy="a b"
        />,
      );
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-describedby",
        "a b",
      );
    });

    it("sets no attribute at all when there is nothing to describe", () => {
      // Not an empty string: an empty aria-describedby is not the same as no
      // description, and some screen readers announce the gap.
      render(<StyledInputToggle value={false} onChange={() => {}} label="X" />);
      expect(screen.getByRole("switch")).not.toHaveAttribute(
        "aria-describedby",
      );
    });

    it("is announced with its description", () => {
      render(
        <>
          <StyledInputToggle
            value={false}
            onChange={() => {}}
            label="Notifications"
            ariaDescribedBy="notify-help"
          />
          <p id="notify-help">Only for medication reminders.</p>
        </>,
      );
      expect(screen.getByRole("switch")).toHaveAccessibleDescription(
        "Only for medication reminders.",
      );
    });
  });

  describe("the id lands on the switch", () => {
    it("puts a caller's id on the button, not on the wrapper", () => {
      render(
        <StyledInputToggle
          value={false}
          onChange={() => {}}
          label="X"
          id="notify"
        />,
      );
      expect(screen.getByRole("switch")).toHaveAttribute("id", "notify");
      expect(document.getElementById("notify")).toBe(
        screen.getByRole("switch"),
      );
    });

    it("lets StyledFieldHelp describe the switch with no shim", () => {
      // The whole reason the id moved. StyledFieldHelp resolves its target
      // with getElementById(htmlFor) and writes aria-describedby on whatever
      // it finds — so with the id on the wrapper it described a <div> that
      // nothing announces, and the switch stayed undescribed.
      render(
        <>
          <StyledFieldHelp htmlFor="notify">
            Only for medication reminders.
          </StyledFieldHelp>
          <StyledInputToggle
            value={false}
            onChange={() => {}}
            label="Notifications"
            id="notify"
          />
        </>,
      );
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-describedby",
        fieldHelpId("notify"),
      );
      expect(screen.getByRole("switch")).toHaveAccessibleDescription(
        "Only for medication reminders.",
      );
    });

    it("merges with an ariaDescribedBy already on the switch", () => {
      // StyledFieldHelp appends rather than replaces, and it has to still do
      // that now that it can actually reach the button.
      render(
        <>
          <StyledFieldHelp htmlFor="notify">Help.</StyledFieldHelp>
          <StyledInputToggle
            value={false}
            onChange={() => {}}
            label="X"
            id="notify"
            ariaDescribedBy="counter"
          />
        </>,
      );
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-describedby",
        `counter ${fieldHelpId("notify")}`,
      );
    });

    it("gives the wrapper no id when only `id` was passed", () => {
      // Naming the old behaviour is `containerId`'s job. If `id` still reached
      // the wrapper as well, the document would hold two elements claiming the
      // same id and getElementById would answer whichever came first.
      const { container } = render(
        <StyledInputToggle
          value={false}
          onChange={() => {}}
          label="X"
          id="notify"
        />,
      );
      expect(container.querySelectorAll("#notify")).toHaveLength(1);
      expect(container.firstElementChild).not.toHaveAttribute("id");
    });

    it("containerId names the old placement for a host that wants it", () => {
      render(
        <StyledInputToggle
          value={false}
          onChange={() => {}}
          label="X"
          id="notify"
          containerId="notify-wrap"
        />,
      );
      const wrapper = document.getElementById("notify-wrap");
      expect(wrapper).not.toBeNull();
      expect(wrapper).not.toHaveAttribute("role");
      expect(wrapper).toContainElement(screen.getByRole("switch"));
    });
  });

  it("uses no palette literals", () => {
    // It painted itself `gray.300` / `green.400` / `white`, so it ignored the
    // theme and dark mode. The tokens now come from TEXT_BACKGROUND_PAIRS, so
    // the handle is readable against whichever track is under it.
    const { container } = render(
      <StyledInputToggle value onChange={() => {}} label="X" />,
    );
    const sheet = Array.from(document.styleSheets)
      .flatMap((s) => Array.from(s.cssRules))
      .map((r) => r.cssText)
      .join("\n");
    expect(container.innerHTML).not.toMatch(/green\.400|gray\.300/);
    expect(sheet).not.toMatch(/#fff\b|\bwhite\b/i);
  });
});
