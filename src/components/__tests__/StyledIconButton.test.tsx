import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StyledIconButton from "../StyledIconButton";
import StyledTooltip from "../StyledTooltip";
import { StonedogStyleProvider } from "../../config/style-config";

const Icon = () => <svg data-testid="icon" />;

describe("StyledIconButton", () => {
  it("renders its icon", () => {
    render(<StyledIconButton aria-label="Close"><Icon /></StyledIconButton>);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("calls onClick", async () => {
    const onClick = jest.fn();
    render(<StyledIconButton aria-label="Close" onClick={onClick}><Icon /></StyledIconButton>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = jest.fn();
    render(
      <StyledIconButton aria-label="Close" disabled onClick={onClick}><Icon /></StyledIconButton>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  describe("naming — the whole accessibility story for this control", () => {
    it("takes its accessible name from aria-label", () => {
      // There is no visible text. Without a name it announces as "button".
      render(<StyledIconButton aria-label="Delete note"><Icon /></StyledIconButton>);
      expect(screen.getByRole("button", { name: "Delete note" })).toBeInTheDocument();
    });

    it("is named by its tooltip when no aria-label is given", () => {
      render(<StyledIconButton tooltip="Delete note"><Icon /></StyledIconButton>);
      expect(screen.getByRole("button", { name: /delete note/i })).toBeInTheDocument();
    });
  });

  describe("variant coercion — the recipe defines only seven", () => {
    it.each(["unstyled", "link", "selected"] as const)(
      "renders %s without throwing, and keeps the request visible",
      (asked) => {
      // The recipe has no rules for these three, so a button asking for one
      // would render with a class name and no styling behind it. Asserting the
      // request survives in data-panda-variant, and that render does not throw.
      render(
        <StyledIconButton aria-label="Go" variant={asked}><Icon /></StyledIconButton>,
      );
        expect(screen.getByRole("button")).toHaveAttribute(
          "data-panda-variant",
          asked,
        );
      },
    );

    it.each(["solid", "outline", "aurora", "glass", "matte", "ghost", "none"] as const)(
      "passes %s through untouched",
      (variant) => {
        render(
          <StyledIconButton aria-label="Go" variant={variant}><Icon /></StyledIconButton>,
        );
        expect(screen.getByRole("button")).toHaveAttribute("data-panda-variant", variant);
      },
    );

    it("falls back to the app-wide variant", () => {
      render(
        <StonedogStyleProvider variant="matte">
          <StyledIconButton aria-label="Go"><Icon /></StyledIconButton>
        </StonedogStyleProvider>,
      );
      expect(screen.getByRole("button")).toHaveAttribute("data-panda-variant", "matte");
    });
  });

  describe("polymorphism", () => {
    it("can render as an anchor", () => {
      render(
        <StyledIconButton as="a" href="/somewhere" aria-label="Go"><Icon /></StyledIconButton>,
      );
      expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/somewhere");
    });

    it("does not put a disabled attribute on an anchor", () => {
      // `disabled` is meaningless on <a> and would be an invalid attribute.
      render(
        <StyledIconButton as="a" href="/x" disabled aria-label="Go"><Icon /></StyledIconButton>,
      );
      expect(screen.getByRole("link")).not.toHaveAttribute("disabled");
    });
  });

  describe("the props that were dropped", () => {
    const STALE = {
      confirm: true,
      confirmTitle: "Sure?",
      confirmBody: "Really?",
      onConfirm: () => {},
      loading: true,
      noBackground: true,
    } as unknown as Record<string, unknown>;

    it("still renders when a stale caller passes a removed prop", () => {
      // confirm/confirmTitle/confirmBody/onConfirm/loading/noBackground all had
      // ZERO effective call sites: the confirm dialog was never triggered,
      // `loading` was never passed, and `noBackground` was accepted and ignored.
      render(
        <StyledIconButton aria-label="Go" {...STALE}><Icon /></StyledIconButton>,
      );
      expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
    });

    it("drops them instead of forwarding them to the DOM (NEH-498)", () => {
      // "Ignored" used to mean "spread onto the element", so `confirm={true}`
      // landed as an invalid attribute and React warned about each one — noise
      // in every consumer's console, for props that do nothing.
      render(
        <StyledIconButton aria-label="Go" {...STALE}><Icon /></StyledIconButton>,
      );
      const button = screen.getByRole("button", { name: "Go" });
      for (const name of Object.keys(STALE)) {
        expect(button).not.toHaveAttribute(name.toLowerCase());
      }
    });

    // Deliberately NOT a console.error spy. React remembers which prop names it
    // has already complained about, process-wide, so a spy in a file that has
    // rendered the component before sees nothing whether or not the props leak
    // — it passed against the unfixed component. The DOM assertion above is the
    // guard; the quiet console is its consequence.
  });

  /**
   * The shape every `stonedog-icons` icon that carries its own tooltip renders
   * in — an icon button whose child is itself tooltipped (NEH-950).
   *
   * This is the assembled case rather than a unit of one component, and it is
   * the only place the defect was visible: neither component was wrong on its
   * own. `StyledIconButton` correctly declined a tab stop because its child
   * (the `<button>`) is focusable; the inner tooltip correctly took one
   * because *its* child (the glyph) is not. Nesting them produced a second,
   * silent stop inside a control the reader had already passed.
   */
  describe("with a tooltipped icon inside it", () => {
    it("contributes exactly one tab stop", () => {
      const { container } = render(
        <StyledIconButton aria-label="Expand">
          <StyledTooltip tooltip="Click to expand to full screen">
            <Icon />
          </StyledTooltip>
        </StyledIconButton>,
      );
      // The issue's own repro, verbatim. Non-empty is the defect.
      expect(container.querySelectorAll('button [tabindex="0"]')).toHaveLength(0);
      expect(
        container.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).toHaveLength(1);
    });

    it("keeps the button's accessible name, and gives the wrapper none", () => {
      const { container } = render(
        <StyledIconButton aria-label="Expand">
          <StyledTooltip tooltip="Click to expand to full screen">
            <Icon />
          </StyledTooltip>
        </StyledIconButton>,
      );
      expect(screen.getByRole("button", { name: "Expand" })).toBeInTheDocument();
      const wrapper = container.querySelector("button > div")!;
      expect(wrapper).not.toHaveAttribute("role");
      expect(wrapper).not.toHaveAttribute("aria-label");
    });
  });

  it("forwards a ref", () => {
    const ref = { current: null } as React.RefObject<HTMLButtonElement | null>;
    render(<StyledIconButton ref={ref} aria-label="Go"><Icon /></StyledIconButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
