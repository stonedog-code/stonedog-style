import { render, screen, fireEvent, act } from "@testing-library/react";
import StyledTooltip from "../StyledTooltip";

/**
 * The tooltip opens after a delay, so every assertion has to push timers.
 * Kept as a helper rather than repeated so a change to the default delay does
 * not mean editing eight tests.
 */
function openBy(trigger: (el: HTMLElement) => void, el: HTMLElement) {
  trigger(el);
  act(() => {
    jest.advanceTimersByTime(200);
  });
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("StyledTooltip", () => {
  it("renders children alone and adds nothing when there is no tooltip text", () => {
    render(
      <StyledTooltip tooltip={null}>
        <button>bare</button>
      </StyledTooltip>,
    );
    expect(screen.getByRole("button", { name: "bare" })).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("stays closed until the delay elapses", () => {
    render(
      <StyledTooltip tooltip="Save your work">
        <button>Save</button>
      </StyledTooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole("button").parentElement!);
    // Before the delay: nothing. A tooltip that fires instantly flickers on
    // every pointer transit across a toolbar.
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on hover", () => {
    render(
      <StyledTooltip tooltip="Save your work">
        <button>Save</button>
      </StyledTooltip>,
    );
    openBy(fireEvent.mouseEnter, screen.getByRole("button").parentElement!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Save your work");
  });

  it("opens on keyboard focus, not only on hover", () => {
    // WCAG 2.2: content revealed on hover must also be reachable by keyboard.
    render(
      <StyledTooltip tooltip="Save your work">
        <button>Save</button>
      </StyledTooltip>,
    );
    openBy(fireEvent.focus, screen.getByRole("button").parentElement!);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("closes again on blur", () => {
    render(
      <StyledTooltip tooltip="Save your work">
        <button>Save</button>
      </StyledTooltip>,
    );
    const trigger = screen.getByRole("button").parentElement!;
    openBy(fireEvent.focus, trigger);
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("describes the focusable child rather than the wrapper", () => {
    // aria-describedby has to sit on whatever actually receives focus, or a
    // screen reader announces the control with no description at all.
    render(
      <StyledTooltip tooltip="Save your work">
        <button>Save</button>
      </StyledTooltip>,
    );
    const button = screen.getByRole("button");
    openBy(fireEvent.focus, button.parentElement!);
    const tooltip = screen.getByRole("tooltip");
    expect(button).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("does not give a focusable child a second tab stop", () => {
    // The child already owns the tab stop; adding one to the wrapper is what
    // produced two tab stops per control, the second of them silent.
    render(
      <StyledTooltip tooltip="Save your work">
        <button>Save</button>
      </StyledTooltip>,
    );
    expect(screen.getByRole("button").parentElement).not.toHaveAttribute("tabindex");
  });

  it("gives a NON-focusable child a tab stop, with a role and a name", () => {
    // A focusable element needs both a role and an accessible name (WCAG 4.1.2).
    render(
      <StyledTooltip tooltip="Explanation">
        <span />
      </StyledTooltip>,
    );
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("tabindex", "0");
    expect(trigger).toHaveAccessibleName("Explanation");
  });

  it("does not invent a name when an ancestor already provides one", () => {
    // Naming unconditionally is what produced two elements claiming the same
    // label, with role="button" nested inside an already-named ancestor.
    render(
      <div aria-label="Shared with three people">
        <StyledTooltip tooltip="Explanation">
          <span />
        </StyledTooltip>
      </div>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not use a non-string tooltip as an accessible name", () => {
    // Stringifying a React element would announce "[object Object]".
    render(
      <StyledTooltip tooltip={<em>rich</em>}>
        <span />
      </StyledTooltip>,
    );
    const trigger = screen.getByText("", { selector: "[tabindex='0']" });
    expect(trigger).not.toHaveAttribute("aria-label");
  });
});

/**
/**
 * The leaked open timer (NEH-818).
 *
 * `show()` runs from the trigger's mouseenter AND its focus, and a single
 * press fires both ~0ms apart. Assigning over `timeoutRef.current` left the
 * first timer running with nothing holding its id, so `hide()` could cancel
 * only the last one scheduled — and the orphan opened a tooltip that no
 * departure event could ever close.
 *
 * The ordering is a pure state question, so it belongs in this tier, where it
 * runs on every save and inside the merge gate. What the stranded tooltip then
 * DOES — sit over a dialog at `pointer-events: auto` and eat a click meant for
 * the control underneath — is a layout question that jsdom cannot answer at
 * all, and lives in `StyledTooltip.ct.tsx`.
 */
describe("StyledTooltip — a pending open must never be orphaned", () => {
  it("does not open after a press-then-leave, whatever order the events arrive in", () => {
    render(
      <StyledTooltip tooltip="Track a medication and set reminders.">
        <button>Add Medicine</button>
      </StyledTooltip>,
    );
    const wrapper = screen.getByRole("button", { name: "Add Medicine" }).parentElement!;

    // The measured sequence from a real press, in order: the pointer arrives,
    // the press focuses the child, the pointer leaves. Note focus is NOT
    // released — a press leaves it on the button, which is why `onBlur` never
    // arrives to save us.
    fireEvent.mouseEnter(wrapper);
    fireEvent.focus(wrapper);
    fireEvent.mouseLeave(wrapper);

    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Before the fix the mouseenter's timer survived `hide()` and fired here.
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("leaves nothing pending that could fire after the trigger is gone", () => {
    const { unmount } = render(
      <StyledTooltip tooltip="Track a medication and set reminders.">
        <button>Add Medicine</button>
      </StyledTooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Add Medicine" }).parentElement!);

    unmount();

    // A timer that outlives its component calls setState on a torn-down tree.
    // `jest.getTimerCount()` is the honest check: asserting no tooltip renders
    // would pass trivially once the tree is gone, which is a green test that
    // cannot fail.
    expect(jest.getTimerCount()).toBe(0);
  });
});

/**
 * Click mode (NEH-222 / the StyledSidebar PRD, §B).
 *
 * Hover tooltips fail readers whose pointer drifts: the panel closes before
 * they arrive, and one they are mid-way through reading vanishes when their
 * hand moves. Click mode exists for them, and the thing that makes it usable
 * is that the help control is *separate* — the child is usually a button, and
 * that button's click has to keep belonging to the button.
 */
/**
 * The help control is named after the thing it explains — "Help: Add", not
 * "More information" (NEH-769). These assertions were flipped deliberately: a
 * screen carrying twenty tooltips carried twenty buttons with the same generic
 * name, so a reader tabbing through heard the same four words twenty times and
 * could not tell which one answered their question. Restoring the old string
 * here would restore that.
 */
describe("StyledTooltip — click mode", () => {
  it("defaults to hover: no help control, opens on pointer-in", () => {
    render(
      <StyledTooltip tooltip="Adds a note">
        <button>Add</button>
      </StyledTooltip>,
    );

    expect(screen.queryByRole("button", { name: /^Help: / })).not.toBeInTheDocument();
    openBy(fireEvent.mouseEnter, screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("renders a named help control and stays shut until it is pressed", () => {
    render(
      <StyledTooltip tooltip="Adds a note" trigger="click">
        <button>Add</button>
      </StyledTooltip>,
    );

    const help = screen.getByRole("button", { name: "Help: Add" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(help).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(help);

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(help).toHaveAttribute("aria-expanded", "true");
  });

  it("ignores hover entirely — the whole reason click mode exists", () => {
    render(
      <StyledTooltip tooltip="Adds a note" trigger="click">
        <button>Add</button>
      </StyledTooltip>,
    );

    openBy(fireEvent.mouseEnter, screen.getByRole("button", { name: "Add" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // ...and an open panel is not dismissed by the pointer wandering off.
    fireEvent.click(screen.getByRole("button", { name: "Help: Add" }));
    fireEvent.mouseLeave(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("leaves the child's own click alone", () => {
    const onClick = jest.fn();
    render(
      <StyledTooltip tooltip="Adds a note" trigger="click">
        <button onClick={onClick}>Add</button>
      </StyledTooltip>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    // Pressing the button must not also open help — that is the confusion this
    // design exists to prevent.
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes on a second press, and on Escape with focus returned", () => {
    render(
      <StyledTooltip tooltip="Adds a note" trigger="click">
        <button>Add</button>
      </StyledTooltip>,
    );
    const help = screen.getByRole("button", { name: "Help: Add" });

    fireEvent.click(help);
    fireEvent.click(help);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(help);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(help).toHaveFocus();
  });

  it("closes on a press outside, but not on one inside the explanation", () => {
    render(
      <StyledTooltip tooltip="Adds a note" trigger="click">
        <button>Add</button>
      </StyledTooltip>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Help: Add" }));

    // Inside: the text may be worth selecting, or contain a link.
    fireEvent.mouseDown(screen.getByRole("tooltip"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("takes a specific help label when the context needs one", () => {
    render(
      <StyledTooltip tooltip="Shows events" trigger="click" helpLabel="What does Calendar do?">
        <button>Calendar</button>
      </StyledTooltip>,
    );

    expect(screen.getByRole("button", { name: "What does Calendar do?" })).toBeInTheDocument();
  });
});

/**
 * Touch: a hover tooltip on a device that cannot hover.
 *
 * This was a documented gap for as long as the component existed, and it
 * stopped being cosmetic when an icon-only navigation rail shipped: on a tablet
 * those icons had no visible name *and* no way to ask for one.
 *
 * jsdom has no `matchMedia`, so these stub it. That is honest rather than
 * convenient — the capability genuinely comes from the platform, and the thing
 * worth pinning is what the component does with each answer.
 */
describe("StyledTooltip — devices that cannot hover", () => {
  const setHoverCapability = (canHover: boolean) => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        // `(hover: none)` matches when the device CANNOT hover.
        matches: query === "(hover: none)" ? !canHover : false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        onchange: null,
        dispatchEvent: jest.fn(),
      }),
    });
  };

  afterEach(() => {
    // Leaving a stub behind would silently decide every later test in the file.
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, "matchMedia");
  });

  it("offers a reachable control instead of an unreachable hover", () => {
    setHoverCapability(false);
    render(
      <StyledTooltip tooltip="What this does" helpLabel="What does Calendar do?">
        <button type="button">Calendar</button>
      </StyledTooltip>,
    );
    // Without this the tooltip is rendered, correct, and impossible to open:
    // there is no hover event, and tapping the child activates the child.
    expect(screen.getByRole("button", { name: "What does Calendar do?" })).toBeInTheDocument();
  });

  it("leaves a hover-capable device alone", () => {
    setHoverCapability(true);
    render(
      <StyledTooltip tooltip="What this does" helpLabel="What does Calendar do?">
        <button type="button">Calendar</button>
      </StyledTooltip>,
    );
    // The blast radius is exactly "cases that were broken". A mouse user must
    // not grow a control they never had.
    expect(
      screen.queryByRole("button", { name: "What does Calendar do?" }),
    ).not.toBeInTheDocument();
  });

  it("does not spawn on a synthetic pointer event when the device cannot hover", () => {
    setHoverCapability(false);
    render(
      <StyledTooltip tooltip="What this does">
        <button type="button">Calendar</button>
      </StyledTooltip>,
    );
    // Touch browsers emit compatibility mouse events after a tap. In click mode
    // nothing responds to a drifting or synthetic pointer, which is the whole
    // point of that mode.
    fireEvent.mouseEnter(screen.getByText("Calendar"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("assumes hover when the platform cannot be asked", () => {
    // jsdom without the stub, and the server. Defaulting the other way would
    // make every desktop render a control and then remove it — a flicker on the
    // majority case, to fix the minority one.
    render(
      <StyledTooltip tooltip="What this does" helpLabel="What does Calendar do?">
        <button type="button">Calendar</button>
      </StyledTooltip>,
    );
    expect(
      screen.queryByRole("button", { name: "What does Calendar do?" }),
    ).not.toBeInTheDocument();
  });
});

/**
 * A tooltip whose trigger sits inside something already focusable (NEH-950).
 *
 * The case the conditional `tabIndex` was written for is a bare tooltipped
 * icon, which genuinely needs a stop of its own (NEH-127). The case it could
 * not see is the mirror image: decorative content inside a control that is
 * already focusable and already named. `hasFocusableChild` looks *down*, so it
 * answered "nothing focusable here" and the wrapper took a tab stop —
 * producing, one level in, the exact silent second stop NEH-127 removed.
 *
 * Every icon in `stonedog-icons` that carries its own tooltip reproduced this
 * inside `StyledIconButton`, in every consumer.
 */
describe("inside a focusable ancestor", () => {
  it("adds no tab stop of its own", () => {
    // The defect, stated as the issue's own repro: `button [tabindex="0"]`
    // must find nothing. Fails against the pre-fix component.
    const { container } = render(
      <button type="button" aria-label="Expand">
        <StyledTooltip tooltip="Click to expand to full screen">
          <span aria-hidden="true">icon</span>
        </StyledTooltip>
      </button>,
    );
    expect(container.querySelectorAll('button [tabindex="0"]')).toHaveLength(0);
  });

  it("leaves the ancestor as the only focusable element, and it keeps its name", () => {
    // WCAG 2.2 4.1.2 — a focusable element needs a role AND a name. One
    // control, named, is the whole of "done" here.
    const { container } = render(
      <button type="button" aria-label="Expand">
        <StyledTooltip tooltip="Click to expand to full screen">
          <span aria-hidden="true">icon</span>
        </StyledTooltip>
      </button>,
    );
    const focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toBe(screen.getByRole("button", { name: "Expand" }));
  });

  it("invents neither a role nor a name for the wrapper", () => {
    // The wrapper used to be a focusable generic with no role and no name, so
    // a screen reader announced nothing at all when Tab landed on it. It must
    // not gain either as a consolation — the ancestor already carries both,
    // and two elements claiming one name is its own bug (NEH-151).
    const { container } = render(
      <button type="button" aria-label="Expand">
        <StyledTooltip tooltip="Click to expand to full screen">
          <span aria-hidden="true">icon</span>
        </StyledTooltip>
      </button>,
    );
    const wrapper = container.querySelector("button > div")!;
    expect(wrapper).not.toHaveAttribute("tabindex");
    expect(wrapper).not.toHaveAttribute("role");
    expect(wrapper).not.toHaveAttribute("aria-label");
  });

  it("still opens on keyboard focus — via the ancestor", () => {
    // WCAG 2.2 2.1.1. Dropping the tab stop without this would trade one
    // failure for another: the explanation would render, and be reachable by
    // pointer only. `focusin` does not travel downwards, so the listener is on
    // the ancestor rather than on the wrapper.
    render(
      <button type="button" aria-label="Expand">
        <StyledTooltip tooltip="Click to expand to full screen">
          <span aria-hidden="true">icon</span>
        </StyledTooltip>
      </button>,
    );
    openBy(fireEvent.focusIn, screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Click to expand to full screen",
    );
  });

  it("closes again when the ancestor loses focus", () => {
    render(
      <button type="button" aria-label="Expand">
        <StyledTooltip tooltip="Click to expand to full screen">
          <span aria-hidden="true">icon</span>
        </StyledTooltip>
      </button>,
    );
    const button = screen.getByRole("button", { name: "Expand" });
    openBy(fireEvent.focusIn, button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.focusOut(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("describes the ancestor, because that is what receives focus", () => {
    // aria-describedby has to sit on the focused element or a screen reader
    // announces the control with no description at all.
    render(
      <button type="button" aria-label="Expand">
        <StyledTooltip tooltip="Click to expand to full screen">
          <span aria-hidden="true">icon</span>
        </StyledTooltip>
      </button>,
    );
    const button = screen.getByRole("button", { name: "Expand" });
    openBy(fireEvent.focusIn, button);
    expect(button).toHaveAttribute(
      "aria-describedby",
      screen.getByRole("tooltip").id,
    );
  });

  it("is dismissible with Escape while the ancestor holds focus", () => {
    // WCAG 2.2 1.4.13 Dismissible. A reader who has read it must be able to
    // clear it without moving focus off the control.
    render(
      <button type="button" aria-label="Expand">
        <StyledTooltip tooltip="Click to expand to full screen">
          <span aria-hidden="true">icon</span>
        </StyledTooltip>
      </button>,
    );
    openBy(fireEvent.focusIn, screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("still gives a bare tooltipped icon a tab stop of its own", () => {
    // The other direction. NEH-127's case must not regress: with nothing
    // focusable above or below, the trigger IS the control, and it keeps both
    // the stop and the role and name that a stop requires.
    // A real icon has no text content, which is exactly why the trigger has
    // to supply the role and the name along with the stop.
    render(
      <StyledTooltip tooltip="Notifications">
        <svg aria-hidden="true" />
      </StyledTooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Notifications" });
    expect(trigger).toHaveAttribute("tabindex", "0");
  });

  it("ignores a non-focusable ancestor", () => {
    // A plain wrapper element must not be mistaken for a control. Only
    // something genuinely in the tab sequence can take the stop over.
    render(
      <div>
        <StyledTooltip tooltip="Notifications">
          <svg aria-hidden="true" />
        </StyledTooltip>
      </div>,
    );
    expect(
      screen.getByRole("button", { name: "Notifications" }),
    ).toHaveAttribute("tabindex", "0");
  });
});

/**
 * Click mode inside a focusable ancestor (NEH-965).
 *
 * The hover-mode guard above cannot see this. It asks about tab stops, and
 * click mode never took one — the defect here is structural: `HelpTrigger` is
 * a real `<button>` rendered beside the child, inside the trigger wrapper, so
 * when the tooltipped thing is an icon inside an icon button the control lands
 * INSIDE that button. `<button>` cannot be a descendant of `<button>`; React
 * warns, and on a server-rendered host it is a hydration error.
 *
 * `isClick` is `trigger === "click" || !canHover`, so this is not a preference
 * anybody opted into: it is the default rendering on every phone and tablet.
 *
 * Measured against the pre-fix component with the issue's own repro:
 * 4 elements, 2 buttons, **1 nested**.
 *
 * The other half of "done" is that removing the nesting must not remove the
 * explanation. On a device that cannot hover there is no hover to fall back
 * on, so a control that is merely absent leaves the help rendered, correct and
 * impossible to reach — which is why the reachability assertions below sit in
 * the same block as the structural one rather than somewhere else.
 */
describe("click mode inside a focusable ancestor (NEH-965)", () => {
  function renderInsideButton(onClick?: () => void) {
    return render(
      <button type="button" aria-label="Expand" onClick={onClick}>
        <StyledTooltip tooltip="Click to expand to full screen" trigger="click">
          {/* The issue's own repro: a decorative icon with no text of its
              own, which is what every stonedog-icons glyph renders. */}
          <svg aria-hidden="true" />
        </StyledTooltip>
      </button>,
    );
  }

  it("renders no button inside a button", () => {
    const { container } = renderInsideButton();

    // The input-set size, asserted rather than assumed. A query over an empty
    // container finds no nested buttons and passes exactly like a correct
    // render, so "0 nested" is only meaningful next to "and here is how much
    // there was to look at". Pre-fix this render was 4 elements / 2 buttons /
    // 1 nested; post-fix it is 5 / 2 / 0 — the extra element is the host span
    // the control was moved into.
    expect(container.querySelectorAll("*").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll("button")).toHaveLength(2);
    expect(container.querySelectorAll("button button")).toHaveLength(0);
  });

  it("puts the help control outside the ancestor, not nowhere", () => {
    // The failure this guards against is the one-line "fix": stop rendering the
    // control when there is a focusable ancestor. That gives valid HTML and an
    // unreachable explanation, and it passes the assertion above.
    const { container } = renderInsideButton();
    const ancestor = screen.getByRole("button", { name: "Expand" });
    const help = screen.getByRole("button", { name: /^Help:/ });

    expect(container).toContainElement(help);
    expect(ancestor).not.toContainElement(help);
  });

  it("names the control after the ancestor, which no longer contains it", () => {
    // Outside the button, "More information" names nothing — the twenty
    // identical controls of NEH-769, one level up.
    renderInsideButton();
    expect(
      screen.getByRole("button", { name: "Help: Expand" }),
    ).toBeInTheDocument();
  });

  it("opens the tooltip when the control is pressed", () => {
    renderInsideButton();
    fireEvent.click(screen.getByRole("button", { name: "Help: Expand" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Click to expand to full screen",
    );
  });

  it("does not fire the ancestor's own action", () => {
    // A React portal bubbles through the REACT tree, not the DOM tree, so the
    // moved control is still inside the button as far as React is concerned.
    // Without stopPropagation, asking for the explanation would also do the
    // thing being explained.
    const onClick = jest.fn();
    renderInsideButton(onClick);
    fireEvent.click(screen.getByRole("button", { name: "Help: Expand" }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("describes the ancestor, because that is what receives focus", () => {
    renderInsideButton();
    fireEvent.click(screen.getByRole("button", { name: "Help: Expand" }));
    expect(screen.getByRole("button", { name: "Expand" })).toHaveAttribute(
      "aria-describedby",
      screen.getByRole("tooltip").id,
    );
  });

  it("still renders the control in place when nothing focusable encloses it", () => {
    // The move is conditional. A plain click-mode tooltip must keep the
    // control beside its subject, where NEH-769 put it.
    const { container } = render(
      <StyledTooltip tooltip="How this is used" trigger="click">
        <label>Require PIN</label>
      </StyledTooltip>,
    );
    const wrapper = container.firstElementChild!;
    expect(wrapper).toContainElement(
      screen.getByRole("button", { name: "Help: Require PIN" }),
    );
    expect(container.querySelectorAll("[data-stonedog-tooltip-help-host]")).toHaveLength(0);
  });
});

/**
 * The moved control has to keep up with the thing it explains.
 *
 * The host span is inserted by this component, not rendered by React, so React
 * does not move it when it moves the ancestor. A reordered row of icon buttons
 * therefore left every help control behind at its old index — measured, before
 * the fix:
 *
 *     before  BTN(Expand) HOST(Help: Expand) BTN(Collapse) HOST(Help: Collapse)
 *     after   HOST(Help: Expand) BTN(Collapse) HOST(Help: Collapse) BTN(Expand)
 *
 * A help control beside the wrong button is worse than the nesting it
 * replaced: the nesting was invalid HTML that still explained the right thing.
 */
describe("the moved help control follows its ancestor (NEH-965)", () => {
  function Row({ order }: { order: string[] }) {
    return (
      <div data-testid="row">
        {order.map((name) => (
          <button type="button" key={name} aria-label={name}>
            <StyledTooltip tooltip={`What ${name} does`} trigger="click">
              <svg aria-hidden="true" />
            </StyledTooltip>
          </button>
        ))}
      </div>
    );
  }

  /** Each row child as `BTN(name)` or `HOST(name)`, in DOM order. */
  function layout(container: HTMLElement): string[] {
    return Array.from(
      container.querySelector('[data-testid="row"]')!.children,
    ).map((el) =>
      el.tagName === "BUTTON"
        ? `BTN(${el.getAttribute("aria-label")})`
        : `HOST(${el.querySelector("button")?.getAttribute("aria-label")})`,
    );
  }

  it("stays immediately after its own button when the row is reordered", () => {
    const { container, rerender } = render(<Row order={["Expand", "Collapse"]} />);

    // The input-set size, stated: four children — two buttons and two hosts.
    // An assertion about ordering over an empty row would pass.
    expect(layout(container)).toEqual([
      "BTN(Expand)",
      "HOST(Help: Expand)",
      "BTN(Collapse)",
      "HOST(Help: Collapse)",
    ]);

    rerender(<Row order={["Collapse", "Expand"]} />);

    expect(layout(container)).toEqual([
      "BTN(Collapse)",
      "HOST(Help: Collapse)",
      "BTN(Expand)",
      "HOST(Help: Expand)",
    ]);
  });

  it("still opens the tooltip belonging to the button it now sits beside", () => {
    // Position is not the claim on its own — the control has to still explain
    // the right thing after the move.
    const { rerender } = render(<Row order={["Expand", "Collapse"]} />);
    rerender(<Row order={["Collapse", "Expand"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Help: Expand" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("What Expand does");
  });
});
