import { render, screen } from "@testing-library/react";
import StyledBox from "../StyledBox";
import StyledHStack from "../StyledHStack";
import StyledStack from "../StyledStack";
import StyledVStack from "../StyledVStack";
import StyledSeparator from "../StyledSeparator";

describe("StyledBox", () => {
  it("renders its children", () => {
    render(<StyledBox>content</StyledBox>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("renders header and footer around the content", () => {
    render(
      <StyledBox header={<span>head</span>} footer={<span>foot</span>}>
        body
      </StyledBox>,
    );
    expect(screen.getByText("head")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByText("foot")).toBeInTheDocument();
  });

  it("treats topPanel/bottomPanel as aliases for header/footer", () => {
    render(
      <StyledBox topPanel={<span>top</span>} bottomPanel={<span>bottom</span>}>
        body
      </StyledBox>,
    );
    expect(screen.getByText("top")).toBeInTheDocument();
    expect(screen.getByText("bottom")).toBeInTheDocument();
  });

  it("skips the side-panel grid entirely when no panels are given", () => {
    // The grid wrapper is not free — it forces three columns and a stretch
    // alignment onto content that asked for neither.
    render(<StyledBox>plain</StyledBox>);
    expect(screen.queryByTestId("styled-grid-panel")).not.toBeInTheDocument();
  });

  it("builds the side-panel grid when a panel is given", () => {
    render(<StyledBox leftPanel={<span>nav</span>}>main</StyledBox>);
    expect(screen.getByTestId("styled-grid-panel")).toBeInTheDocument();
    expect(screen.getByText("nav")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("renders children bare under noWrap, with no scroll scaffolding", () => {
    render(<StyledBox noWrap>bare</StyledBox>);
    expect(screen.getByText("bare")).toBeInTheDocument();
    expect(screen.queryByTestId("styled-grid-panel")).not.toBeInTheDocument();
  });

  it("still honours header and footer under noWrap", () => {
    render(
      <StyledBox noWrap header={<span>h</span>} footer={<span>f</span>}>
        body
      </StyledBox>,
    );
    expect(screen.getByText("h")).toBeInTheDocument();
    expect(screen.getByText("f")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("forwards a ref to the root element", () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement | null>;
    render(<StyledBox ref={ref}>x</StyledBox>);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });
});

describe("StyledStack", () => {
  it("stacks vertically by default", () => {
    render(
      <StyledStack>
        <span>a</span>
        <span>b</span>
      </StyledStack>,
    );
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
  });

  it("places a divider BETWEEN children, never before the first or after the last", () => {
    render(
      <StyledStack divider={<hr data-testid="divider" />}>
        <span>a</span>
        <span>b</span>
        <span>c</span>
      </StyledStack>,
    );
    // Three children means exactly two gaps.
    expect(screen.getAllByTestId("divider")).toHaveLength(2);
  });

  it("adds no divider to a single child", () => {
    render(
      <StyledStack divider={<hr data-testid="divider" />}>
        <span>only</span>
      </StyledStack>,
    );
    expect(screen.queryByTestId("divider")).not.toBeInTheDocument();
  });

  it("accepts a responsive direction without crashing", () => {
    render(
      <StyledStack direction={{ base: "column", md: "row" }}>
        <span>responsive</span>
      </StyledStack>,
    );
    expect(screen.getByText("responsive")).toBeInTheDocument();
  });
});

/**
 * NEH-288. The `hstack`/`vstack` patterns hard-code `alignItems: "center"` and
 * then spread the caller's remaining props over it. Only a prop literally named
 * `alignItems` lands in that spread and wins; anything else survives into
 * `css()` as an unknown key and emits a class name with no rule behind it,
 * while the hard-coded centre stays.
 *
 * These assert the emitted class rather than a computed style because jsdom has
 * no layout engine — the pixel proof is in `StyledHStack.ct.tsx`.
 */
describe.each([
  ["StyledHStack", StyledHStack],
  ["StyledVStack", StyledVStack],
] as const)("%s alignment props", (_name, Stack) => {
  const alignments = ["flex-start", "flex-end", "baseline", "stretch"] as const;

  it.each(alignments)("maps alignItems=%s onto the alignItems utility", (value) => {
    const { container } = render(<Stack alignItems={value}>x</Stack>);
    const className = (container.firstChild as HTMLElement).className;

    expect(className).toContain(`ai_${value}`);
    // The pattern's hard-coded default must have been overridden, not joined.
    expect(className).not.toContain("ai_center");
    // `align_*` is not a Panda utility: a class with no rule behind it.
    expect(className).not.toMatch(/\balign_/);
  });

  it.each(alignments)("treats align=%s as an alias for alignItems", (value) => {
    const { container } = render(<Stack align={value}>x</Stack>);
    const className = (container.firstChild as HTMLElement).className;

    expect(className).toContain(`ai_${value}`);
    expect(className).not.toMatch(/\balign_/);
  });

  it("still centres when neither prop is given", () => {
    const { container } = render(<Stack>x</Stack>);
    expect((container.firstChild as HTMLElement).className).toContain("ai_center");
  });

  it("maps justifyContent onto the justifyContent utility", () => {
    const { container } = render(<Stack justifyContent="space-between">x</Stack>);
    expect((container.firstChild as HTMLElement).className).toContain("jc_space-between");
  });
});

describe("StyledSeparator", () => {
  it("renders horizontally by default", () => {
    const { container } = render(<StyledSeparator />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders a vertical separator with a different class than a horizontal one", () => {
    // Asserting the recipe actually produced two distinct results — the kind of
    // check that is impossible when styled-system is mocked.
    const horizontal = render(<StyledSeparator orientation="horizontal" />);
    const vertical = render(<StyledSeparator orientation="vertical" />);
    expect((horizontal.container.firstChild as HTMLElement).className).not.toBe(
      (vertical.container.firstChild as HTMLElement).className,
    );
  });
});

/**
 * NEH-1868. `StyledVStack` never read `as`, and `StyledStack` (a column by
 * default) forwards to it — so `<StyledStack as="ul">` rendered
 * `<div as="ul">` with every `<li>` orphaned. Element and role are jsdom-safe
 * facts; the layout half (gap, reset, a caller's spacing winning) is measured
 * in `StyledStack.ct.tsx`.
 */
describe.each([
  ["StyledVStack", StyledVStack],
  ["StyledHStack", StyledHStack],
  ["StyledStack", StyledStack],
] as const)("%s as", (_name, Stack) => {
  it.each(["ul", "ol"] as const)("as=%s renders that list, whose items are its children", (tag) => {
    const { container } = render(
      <Stack as={tag} data-testid="stack">
        <li>one</li>
        <li>two</li>
      </Stack>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.tagName).toBe(tag.toUpperCase());
    expect(root).not.toHaveAttribute("as");
    expect(screen.getByRole("list")).toBe(root);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // Restated because Safari strips list semantics from `list-style: none`.
    expect(root).toHaveAttribute("role", "list");
  });

  it("a caller's own role wins over the restated list role", () => {
    const { container } = render(
      <Stack as="ul" role="menu">
        <li role="none">x</li>
      </Stack>,
    );
    expect(container.firstChild).toHaveAttribute("role", "menu");
  });

  it("renders a div with no role and no stray attribute when `as` is omitted", () => {
    const { container } = render(<Stack>x</Stack>);
    const root = container.firstChild as HTMLElement;
    expect(root.tagName).toBe("DIV");
    expect(root).not.toHaveAttribute("as");
    expect(root).not.toHaveAttribute("role");
  });

  it("renders a non-list element without the list reset", () => {
    const { container } = render(<Stack as="section">x</Stack>);
    const root = container.firstChild as HTMLElement;
    expect(root.tagName).toBe("SECTION");
    expect(root.className).not.toContain("li-s_none");
  });
});

describe("StackElement typing", () => {
  it("refuses an element a stack cannot be, at compile time", () => {
    const Custom = () => null;
    // These lines are the test: `tsc` fails the gate if either stops erroring.
    // @ts-expect-error — a table is not a flex container of arbitrary children.
    const table = <StyledStack as="table" />;
    // @ts-expect-error — a component is not an intrinsic element name.
    const component = <StyledVStack as={Custom} />;
    expect([table, component]).toHaveLength(2);
  });
});
