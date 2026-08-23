import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StyledImageUpload from "../StyledImageUpload";

/**
 * `StyledImageUpload`, at the tier that can answer wiring and ARIA.
 *
 * Every assertion here corresponds to something the originating app's e2e spec
 * pins, pulled down to the tier that can run in a second. They look obvious and
 * each one is a way a hand-rolled file input silently stops working:
 *
 *   - `display: none` on the input detaches it from the accessibility tree
 *   - a div-with-onClick dropzone is unreachable by keyboard
 *   - an icon-only dropzone announces nothing
 *   - a remove button named "Remove" three times over says which file
 *
 * No colour or size is asserted — both resolve through custom properties that
 * jsdom does not evaluate (NEH-406). `StyledImageUpload.ct.tsx` is where a real
 * engine would answer those.
 */

function pngFile(name: string): File {
  return new File(["x"], name, { type: "image/png" });
}

/**
 * jsdom implements neither `URL.createObjectURL` nor `revokeObjectURL`, so the
 * preview effect throws and React unmounts the whole tree — which surfaces as
 * an empty `<body>` and a dozen unrelated-looking failures.
 *
 * Stubbing them is not merely a workaround: it is what makes the blob lifecycle
 * assertable at all. The component creates one URL per File and revokes it on
 * cleanup, and a leak there is invisible in every other tier.
 */
let createObjectURL: jest.Mock;
let revokeObjectURL: jest.Mock;

beforeEach(() => {
  let n = 0;
  createObjectURL = jest.fn(() => `blob:stub/${++n}`);
  revokeObjectURL = jest.fn();
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
  });
});

describe("StyledImageUpload", () => {
  it("keeps a real file input attached to the accessibility tree", () => {
    const { container } = render(<StyledImageUpload />);
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    // `display: none` and `visibility: hidden` both REMOVE the control from the
    // accessibility tree. The clip-rect technique hides it visually and keeps
    // it a real, reachable form control — that distinction is the whole point.
    //
    // Asserted as inline style rather than through `toHaveStyle`, which
    // compares against the browser default and would pass for the wrong reason.
    const style = (input as HTMLInputElement).style;
    expect(style.display).not.toBe("none");
    expect(style.visibility).not.toBe("hidden");
    expect(style.position).toBe("absolute");
    expect(style.width).toBe("1px");
  });

  it("announces the dropzone in words, not by icon alone", () => {
    render(<StyledImageUpload dropzoneText="Drag and drop an image or" />);
    expect(screen.getByText("Drag and drop an image or")).toBeInTheDocument();
  });

  /**
   * The trigger must be a real <button>. A div with an onClick is neither
   * focusable nor Enter/Space-activated, so the control would be pointer-only —
   * WCAG 2.2 2.1.1. Driving it with the KEYBOARD rather than `.click()` is what
   * makes this test able to fail for the right reason.
   */
  it("opens the picker from the keyboard", async () => {
    const user = userEvent.setup();
    const { container } = render(<StyledImageUpload buttonText="Upload Image" />);
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clicked = jest.fn();
    input.addEventListener("click", clicked);

    // The visually-hidden input keeps its own tab stop — deliberately, since
    // that is what lets a keyboard user reach the file picker directly. The
    // button is the SECOND stop, so this walks to it rather than assuming it
    // is first; asserting focus before pressing Enter is what stops this test
    // passing because some other element handled the key.
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: /Upload Image/ })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(clicked).toHaveBeenCalled();
  });

  it("sets multiple only when more than one file is allowed", () => {
    const { container, rerender } = render(<StyledImageUpload maxFiles={1} />);
    expect(container.querySelector('input[type="file"]')).not.toHaveAttribute(
      "multiple",
    );
    rerender(<StyledImageUpload maxFiles={3} />);
    expect(container.querySelector('input[type="file"]')).toHaveAttribute(
      "multiple",
    );
  });

  it("caps the selection at maxFiles and reports it", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    const { container } = render(
      <StyledImageUpload maxFiles={2} onChange={onChange} />,
    );
    await user.upload(container.querySelector('input[type="file"]')!, [
      pngFile("a.png"),
      pngFile("b.png"),
      pngFile("c.png"),
    ]);
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: "a.png" }),
      expect.objectContaining({ name: "b.png" }),
    ]);
  });

  /**
   * Three previews mean three remove buttons. A shared "Remove" name leaves a
   * screen-reader user guessing which one they are on, so the file name is part
   * of the accessible name.
   */
  it("names each remove button after the file it removes", async () => {
    const user = userEvent.setup();
    const { container } = render(<StyledImageUpload maxFiles={2} />);
    await user.upload(container.querySelector('input[type="file"]')!, [
      pngFile("cat.png"),
      pngFile("dog.png"),
    ]);
    expect(
      screen.getByRole("button", { name: "Remove cat.png" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove dog.png" }),
    ).toBeInTheDocument();
  });

  it("removes only the file whose button was pressed", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    const { container } = render(
      <StyledImageUpload maxFiles={2} onChange={onChange} />,
    );
    await user.upload(container.querySelector('input[type="file"]')!, [
      pngFile("cat.png"),
      pngFile("dog.png"),
    ]);
    onChange.mockClear();
    await user.click(screen.getByRole("button", { name: "Remove cat.png" }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: "dog.png" }),
    ]);
  });

  /**
   * One object URL per preview, and every one of them released.
   *
   * Creating the URL during render instead of in an effect leaks a blob on
   * every re-render, and dropping the cleanup leaks one per removed preview.
   * Neither shows up as a failing render, a console warning, or anything a
   * screenshot could catch — the page simply holds the file's bytes until it is
   * closed. This is the only tier that can see it.
   */
  it("releases the object URL when a preview goes away", async () => {
    const user = userEvent.setup();
    const { container } = render(<StyledImageUpload maxFiles={2} />);
    await user.upload(container.querySelector('input[type="file"]')!, [
      pngFile("cat.png"),
      pngFile("dog.png"),
    ]);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove cat.png" }));
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  /**
   * The package ships no artwork, so the default is no glyph at all and the
   * words carry the meaning. Both halves are asserted: absent by default, and
   * present-but-hidden when supplied — a glyph that reached the accessibility
   * tree would be read out alongside the name that already says everything.
   */
  describe("the icon seam", () => {
    it("renders no glyph by default", () => {
      render(<StyledImageUpload buttonText="Upload Image" />);
      const button = screen.getByRole("button", { name: /Upload Image/ });
      expect(button.querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it("renders a supplied glyph, hidden from assistive technology", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <StyledImageUpload
          buttonText="Upload Image"
          fileIcon={<svg data-testid="file-glyph" />}
          removeIcon={<svg data-testid="remove-glyph" />}
        />,
      );
      expect(screen.getByTestId("file-glyph").closest('[aria-hidden="true"]'))
        .not.toBeNull();

      await user.upload(
        container.querySelector('input[type="file"]')!,
        pngFile("cat.png"),
      );
      expect(screen.getByTestId("remove-glyph").closest('[aria-hidden="true"]'))
        .not.toBeNull();
      // The name still comes from the button, not the glyph.
      expect(
        screen.getByRole("button", { name: "Remove cat.png" }),
      ).toBeInTheDocument();
    });
  });
});
