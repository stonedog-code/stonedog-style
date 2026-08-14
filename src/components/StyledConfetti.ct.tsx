import { test, expect } from "@playwright/experimental-ct-react";
import StyledConfetti from "./StyledConfetti";

/**
 * The half of `StyledConfetti` that needs a real engine (NEH-430).
 *
 * Two claims live here and neither is answerable in jsdom: that the overlay
 * does not swallow clicks on the UI beneath it, and that the particles are
 * actually painted — a class name with no rule behind it is this package's
 * signature failure, and the burst is exactly the shape that produces one,
 * since a token chosen at runtime extracts to nothing.
 */

test("the overlay does not swallow clicks on what is underneath", async ({
  mount,
}) => {
  // The real risk of a fixed, full-viewport decoration. `pointer-events: none`
  // is the whole defence and jsdom loads no stylesheet to check it against, so
  // this is the only tier that can tell.
  const component = await mount(
    <div>
      <button type="button" data-testid="beneath">
        Click me
      </button>
      <StyledConfetti trigger particleCount={40} />
    </div>,
  );

  await expect(component.getByTestId("styled-confetti")).toBeVisible();

  // Would time out if the overlay were intercepting pointer events.
  await component.getByTestId("beneath").click({ timeout: 3000 });
});

test("the particles are actually painted", async ({ mount }) => {
  // Panda extracts statically, so `css({ backgroundColor: someVariable })`
  // emits no rule while still putting a class in the DOM — invisible confetti,
  // no build error, nothing in the console. That is why the four colours are
  // written as four literal `css()` calls, and this is what proves it worked.
  const component = await mount(<StyledConfetti trigger particleCount={8} />);

  const first = component.getByTestId("styled-confetti-particle").first();
  const background = await first.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );

  expect(background).not.toBe("");
  // `rgba(0, 0, 0, 0)` is what an undefined token resolves to — the exact
  // symptom of the extraction failure above.
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
});

test("an animation is running on each particle", async ({ mount }) => {
  const component = await mount(<StyledConfetti trigger particleCount={5} />);

  const name = await component
    .getByTestId("styled-confetti-particle")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);

  // `none` would mean the keyframe never reached the stylesheet — the same
  // silent-extraction problem one layer up.
  expect(name).not.toBe("none");
  expect(name).toContain("ConfettiBurst");
});

test("emoji particles carry no coloured square behind the glyph", async ({
  mount,
}) => {
  const component = await mount(
    <StyledConfetti trigger particleCount={4} emojis={["🎉"]} />,
  );

  const background = await component
    .getByTestId("styled-confetti-particle")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);

  expect(background).toBe("rgba(0, 0, 0, 0)");
});
