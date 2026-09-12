import React from "react";
import { render } from "@testing-library/react";
import StyledLabeledValue, { LABELED_VALUE_LAYOUTS } from "../StyledLabeledValue";
import StyledBox from "../StyledBox";
import StyledText from "../StyledText";
import { findRunOnPairs } from "../../../test/run-on";

/**
 * The plant is not synthetic. It is the Statistic readout from a real consumer's
 * number tile as it shipped, rendering "Average182.7 points": a small secondary
 * label over a bold figure, two `StyledText` siblings in a `StyledBox`, no
 * separator and no spacing prop. A minimal `<span/><span/>` plant would prove
 * the detector sees spans; this proves it sees the shape that actually shipped,
 * `StyledBox`'s wrapper divs included.
 */
function PlantedRunOn() {
  return (
    <StyledBox>
      <StyledText size="sm" color="textSecondary">
        Average
      </StyledText>
      <StyledText fontWeight="bold">182.7 points</StyledText>
    </StyledBox>
  );
}

/** The same readout, through the component that makes the plant unwritable. */
function Healthy({ layout }: { layout?: "stacked" | "inline" }) {
  return (
    <StyledBox>
      <StyledLabeledValue label="Average" value="182.7 points" layout={layout} />
    </StyledBox>
  );
}

describe("the run-on detector, proved in both directions first", () => {
  it("catches the planted run-on taken from a real call site", () => {
    const { container } = render(<PlantedRunOn />);
    // Count first. StyledBox puts wrapper divs between the box and its
    // children; a detector that never reached the spans would report zero here
    // for the wrong reason.
    expect(container.querySelectorAll("span")).toHaveLength(2);
    const pairs = findRunOnPairs(container);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.first.textContent).toBe("Average");
    expect(pairs[0]!.second.textContent).toBe("182.7 points");
    // What the reader gets: one run, with no boundary anywhere in the markup.
    expect(pairs[0]!.parent.textContent).toBe("Average182.7 points");
  });

  it("does not flag the same pair once both siblings are promoted", () => {
    // The consumer-side fix, `block` on both. If the detector flagged this it
    // would be keyed on the tag, not on the box.
    const { container } = render(
      <StyledBox>
        <StyledText block size="sm" color="textSecondary">
          Average
        </StyledText>
        <StyledText block fontWeight="bold">
          182.7 points
        </StyledText>
      </StyledBox>,
    );
    expect(container.querySelectorAll("span")).toHaveLength(2);
    expect(findRunOnPairs(container)).toHaveLength(0);
  });

  it("does not flag a pair with a real space between them", () => {
    const { container } = render(
      <StyledBox>
        <StyledText>Average</StyledText> <StyledText>182.7 points</StyledText>
      </StyledBox>,
    );
    expect(container.querySelectorAll("span")).toHaveLength(2);
    expect(findRunOnPairs(container)).toHaveLength(0);
  });
});

describe("StyledLabeledValue", () => {
  it("renders exactly one dl holding one dt and one dd", () => {
    const { container } = render(<StyledLabeledValue label="Average" value="182.7 points" />);
    expect(container.querySelectorAll("dl")).toHaveLength(1);
    const dl = container.querySelector("dl")!;
    expect(Array.from(dl.children).map((el) => el.tagName)).toEqual(["DT", "DD"]);
  });

  it("puts the label in the term and the value in the definition", () => {
    // A boundary textContent CAN see. The planted run-on has no element whose
    // text is the value alone; this has one, and it is the dd.
    const { container } = render(<StyledLabeledValue label="Average" value="182.7 points" />);
    expect(container.querySelector("dt")!.textContent).toBe("Average");
    expect(container.querySelector("dd")!.textContent).toBe("182.7 points");
  });

  it.each(LABELED_VALUE_LAYOUTS)("renders dt and dd as block boxes in the %s layout", (layout) => {
    const { container } = render(
      <StyledLabeledValue label="Average" value="182.7 points" layout={layout} />,
    );
    const parts = container.querySelectorAll("dt, dd");
    expect(parts).toHaveLength(2);
    parts.forEach((el) => expect(getComputedStyle(el).display).toBe("block"));
  });

  it.each(LABELED_VALUE_LAYOUTS)(
    "cannot produce a run-on where the plant did, in the %s layout",
    (layout) => {
      const { container } = render(<Healthy layout={layout} />);
      // Two spans, so the detector had something to look at, the same as the plant.
      expect(container.querySelectorAll("span")).toHaveLength(2);
      expect(findRunOnPairs(container)).toHaveLength(0);
    },
  );

  it("lays the pair out as a flex column by default and a wrapping row when inline", () => {
    const { container, rerender } = render(<StyledLabeledValue label="A" value="B" />);
    const dl = () => container.querySelector("dl")!;
    expect(dl().getAttribute("data-layout")).toBe("stacked");
    expect(dl().style.display).toBe("flex");
    expect(dl().style.flexDirection).toBe("column");

    rerender(<StyledLabeledValue label="A" value="B" layout="inline" />);
    expect(dl().getAttribute("data-layout")).toBe("inline");
    expect(dl().style.display).toBe("flex");
    expect(dl().style.flexWrap).toBe("wrap");
  });

  it("falls back to stacked for a layout it does not define", () => {
    const { container } = render(
      <StyledLabeledValue
        label="A"
        value="B"
        layout={"sideways" as unknown as "stacked"}
      />,
    );
    expect(container.querySelector("dl")!.getAttribute("data-layout")).toBe("stacked");
  });

  it("forwards a ref and DOM attributes to the dl", () => {
    const ref = React.createRef<HTMLDListElement>();
    const { getByTestId } = render(
      <StyledLabeledValue ref={ref} label="A" value="B" data-testid="pair" className="mine" />,
    );
    expect(ref.current?.tagName).toBe("DL");
    expect(getByTestId("pair")).toHaveClass("mine");
  });
});
