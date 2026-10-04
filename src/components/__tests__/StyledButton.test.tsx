import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StyledButton from "../StyledButton";
import { StonedogStyleProvider } from "../../config/style-config";
import { ALL_VARIANTS } from "../../config/types";

describe("StyledButton", () => {
  it("renders its label", () => {
    render(<StyledButton>Save</StyledButton>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("calls onClick", async () => {
    const onClick = jest.fn();
    render(<StyledButton onClick={onClick}>Save</StyledButton>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards a ref to the button element", () => {
    // Focus management and scroll-into-view both need the real node.
    const ref = { current: null } as React.RefObject<HTMLButtonElement | null>;
    render(<StyledButton ref={ref}>Save</StyledButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("defaults to type=submit like a native button", () => {
    // Documenting the inherited behaviour rather than asserting an opinion:
    // the component sets no type, so it is whatever the platform does.
    render(<StyledButton>Save</StyledButton>);
    expect(screen.getByRole("button")).not.toHaveAttribute("type", "button");
  });

  describe("variants", () => {
    it.each(ALL_VARIANTS)("accepts %s without coercing it", (variant) => {
      // The button recipe defines all ten. `useResolvedVariant` narrows to the
      // five theme ones, so using it here would silently turn every ghost and
      // link button solid — this asserts it does not.
      render(<StyledButton variant={variant}>Go</StyledButton>);
      expect(screen.getByRole("button")).toHaveAttribute(
        "data-panda-variant",
        variant,
      );
    });

    it("falls back to the app-wide variant when the caller gives none", () => {
      render(
        <StonedogStyleProvider variant="matte">
          <StyledButton>Go</StyledButton>
        </StonedogStyleProvider>,
      );
      expect(screen.getByRole("button")).toHaveAttribute(
        "data-panda-variant",
        "matte",
      );
    });

    it("lets the caller override the app-wide variant", () => {
      render(
        <StonedogStyleProvider variant="matte">
          <StyledButton variant="ghost">Go</StyledButton>
        </StonedogStyleProvider>,
      );
      expect(screen.getByRole("button")).toHaveAttribute(
        "data-panda-variant",
        "ghost",
      );
    });
  });

  describe("loading", () => {
    it("shows a spinner instead of the label", () => {
      render(<StyledButton loading>Save</StyledButton>);
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.queryByText("Save")).not.toBeInTheDocument();
    });

    it("names what is happening when given loadText", () => {
      render(
        <StyledButton loading loadText="Saving your note">
          Save
        </StyledButton>,
      );
      expect(screen.getByText("Saving your note")).toBeInTheDocument();
    });

    it("refuses a click so a second submit cannot fire", async () => {
      // The classic double-charge bug. A loading button that stays clickable is
      // the whole reason this behaviour exists.
      const onClick = jest.fn();
      render(
        <StyledButton loading onClick={onClick}>
          Pay
        </StyledButton>,
      );
      const button = screen.getByRole("button");
      await userEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("is aria-disabled, NOT disabled, so it can keep the focus (NEH-1860)", () => {
      // A disabled element cannot hold focus; Chrome drops it to <body>. The
      // browser tier (StyledButton.ct.tsx) proves the focus stays — jsdom does
      // not move focus off a disabled element, so it can only check the wiring.
      render(<StyledButton loading>Pay</StyledButton>);
      const button = screen.getByRole("button");
      expect(button).not.toHaveProperty("disabled", true);
      expect(button).toHaveAttribute("aria-disabled", "true");
      // jest-dom's toBeDisabled reads the property only; the accessibility
      // tree reads aria-disabled, which is what a screen reader announces.
      expect(button).not.toBeDisabled();
    });

    it("refuses Enter and Space on the focused button", async () => {
      const onClick = jest.fn();
      render(
        <StyledButton loading onClick={onClick}>
          Pay
        </StyledButton>,
      );
      screen.getByRole("button").focus();
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard(" ");
      expect(onClick).not.toHaveBeenCalled();
    });

    it("does not let the click reach a React ancestor's onClick", async () => {
      // A disabled button dispatched no click at all, so an ancestor heard
      // nothing; the guard keeps that.
      const outer = jest.fn();
      render(
        <div onClick={outer}>
          <StyledButton loading>Pay</StyledButton>
        </div>,
      );
      await userEvent.click(screen.getByRole("button"));
      expect(outer).not.toHaveBeenCalled();
    });

    it("does not submit its form — by click, Enter on it, or Enter in a field", async () => {
      const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          <label>
            Name <input name="name" />
          </label>
          <StyledButton type="submit" loading>
            Pay
          </StyledButton>
        </form>,
      );
      const button = screen.getByRole("button");
      await userEvent.click(button);
      button.focus();
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard(" ");
      await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Ada{Enter}");
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("the same form DOES submit when the button is not loading (control)", async () => {
      // Without this, the test above would pass over a harness that cannot
      // submit at all.
      const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          <label>
            Name <input name="name" />
          </label>
          <StyledButton type="submit">Pay</StyledButton>
        </form>,
      );
      await userEvent.click(screen.getByRole("button"));
      await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Ada{Enter}");
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });

    it("fires onClick again once loading ends", async () => {
      const onClick = jest.fn();
      const { rerender } = render(
        <StyledButton loading onClick={onClick}>
          Pay
        </StyledButton>,
      );
      rerender(<StyledButton onClick={onClick}>Pay</StyledButton>);
      const button = screen.getByRole("button");
      expect(button).not.toHaveAttribute("aria-disabled");
      await userEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("marks itself busy for assistive technology", () => {
      // Without aria-busy a screen-reader user is told the control is disabled
      // and not told why.
      render(<StyledButton loading>Save</StyledButton>);
      expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    });

    it("is not busy when idle", () => {
      render(<StyledButton>Save</StyledButton>);
      expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy", "true");
    });
  });

  describe("disabled", () => {
    it("is still the real disabled property, unchanged by NEH-1860", () => {
      render(<StyledButton disabled>Save</StyledButton>);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute("aria-disabled");
      expect(button).not.toHaveAttribute("aria-busy");
    });

    it("does not submit its form", async () => {
      const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          <StyledButton type="submit" disabled>
            Save
          </StyledButton>
        </form>,
      );
      await userEvent.click(screen.getByRole("button"));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("stays the property when loading as well", () => {
      render(
        <StyledButton disabled loading>
          Save
        </StyledButton>,
      );
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });

    it("does not fire onClick", async () => {
      const onClick = jest.fn();
      render(
        <StyledButton disabled onClick={onClick}>
          Save
        </StyledButton>,
      );
      await userEvent.click(screen.getByRole("button"));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("icons", () => {
    it("renders a left icon before the label", () => {
      render(
        <StyledButton leftIcon={<svg data-testid="left" />}>Save</StyledButton>,
      );
      expect(screen.getByTestId("left")).toBeInTheDocument();
    });

    it("renders a right icon after the label", () => {
      render(
        <StyledButton rightIcon={<svg data-testid="right" />}>Save</StyledButton>,
      );
      expect(screen.getByTestId("right")).toBeInTheDocument();
    });

    it("renders both at once", () => {
      render(
        <StyledButton
          leftIcon={<svg data-testid="left" />}
          rightIcon={<svg data-testid="right" />}
        >
          Save
        </StyledButton>,
      );
      expect(screen.getByTestId("left")).toBeInTheDocument();
      expect(screen.getByTestId("right")).toBeInTheDocument();
    });

    it("takes any node, not just an element", () => {
      // The icon seam means a consumer may hand over anything — a Lucide
      // component, a Font Awesome wrapper, or plain text.
      render(<StyledButton leftIcon="→">Next</StyledButton>);
      expect(screen.getByRole("button")).toHaveTextContent("→");
    });
  });

  describe("tooltip", () => {
    it("renders without one", () => {
      render(<StyledButton>Save</StyledButton>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("does not swallow the button when one is given", () => {
      render(<StyledButton tooltip="Saves your work">Save</StyledButton>);
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });
  });

  describe("layout props", () => {
    it("applies noWrap as a real style so a label cannot break mid-word", () => {
      render(<StyledButton noWrap>A long label</StyledButton>);
      expect(screen.getByRole("button")).toHaveStyle({ whiteSpace: "nowrap" });
    });

    it("applies positioning props as inline style, not classes", () => {
      // Panda would emit these as atomic classes, which lose to the recipe's
      // own class in the cascade — so a caller positioning a button absolutely
      // would find it ignored.
      render(
        <StyledButton position="absolute" top="10px" right="4px" zIndex={5}>
          Close
        </StyledButton>,
      );
      expect(screen.getByRole("button")).toHaveStyle({
        position: "absolute",
        top: "10px",
        right: "4px",
        zIndex: "5",
      });
    });

    it("lets a caller's own style win over the generated one", () => {
      render(<StyledButton style={{ opacity: 0.5 }}>Save</StyledButton>);
      expect(screen.getByRole("button")).toHaveStyle({ opacity: "0.5" });
    });
  });
});
