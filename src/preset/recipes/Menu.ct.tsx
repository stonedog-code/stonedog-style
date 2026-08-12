import { test, expect } from "@playwright/experimental-ct-react";
import { MenuHarness } from "./Menu.harness";

/**
 * The only `.ct.tsx` outside `src/components`, deliberately.
 *
 * `menuRecipe` ships without a component — consumers build their own menu on
 * top of it — so the thing under test is the recipe, and the test sits with it.
 * Putting a `Menu.ct.tsx` in `components/` would advertise a `StyledMenu` that
 * does not exist.
 *
 * It has to be this tier. jsdom reports a zero-sized box for every element, so
 * a jest assertion on menu-item height agrees with any value, including the 34px
 * this recipe actually rendered (NEH-542).
 */
test.describe("menuRecipe", () => {
  test("every item clears the 48px target floor", async ({ mount }) => {
    const component = await mount(<MenuHarness />);
    const items = component.getByRole("menuitem");
    const boxes = await items.all();
    expect(boxes.length).toBeGreaterThan(0);
    for (const item of boxes) {
      const rect = await item.boundingBox();
      expect(rect!.height).toBeGreaterThanOrEqual(48);
    }
  });

  // The floor exists because height must NOT be what the text happens to
  // produce. Removing `minHeight` and re-measuring gives 32 / 34 / 37 / 39px
  // across sm → xl: short at every profile, and *differently* short at each,
  // which is the point. A derived height tracks whatever the type scale does,
  // so it would have to be re-checked after every typography change — and the
  // one before this moved the whole scale.
  for (const [profile, value] of [
    ["sm", "0.875rem"],
    ["md", "1rem"],
    ["lg", "1.125rem"],
    ["xl", "1.25rem"],
  ] as const) {
    test(`holds at the ${profile} font-size profile`, async ({ mount }) => {
      const component = await mount(<MenuHarness fontSize={value} />);
      for (const item of await component.getByRole("menuitem").all()) {
        const rect = await item.boundingBox();
        expect(rect!.height).toBeGreaterThanOrEqual(48);
      }
    });
  }

  test("a long label grows the item rather than being clipped", async ({ mount }) => {
    // The floor is a minimum, not a fixed height. Pinning `height` instead
    // would trade a tap-target bug for a truncation one at the large profiles,
    // which is the defect NEH-435 fixed on the width axis.
    const component = await mount(
      <MenuHarness
        fontSize="1.25rem"
        labels={["Sign out of every device and end this session everywhere"]}
      />,
    );
    const item = component.getByRole("menuitem").first();
    const rect = await item.boundingBox();
    const scrollHeight = await item.evaluate((el) => el.scrollHeight);
    expect(rect!.height).toBeGreaterThanOrEqual(48);
    expect(rect!.height).toBeGreaterThanOrEqual(scrollHeight);
  });
});
