import React from "react";
import { menuRecipe } from "styled-system/recipes";

/**
 * Mount target for `Menu.ct.tsx`.
 *
 * The harness applies the real generated class directly rather than going
 * through `StyledMenu`, because a host may build its own menu on this recipe
 * (HopperGuard does) and the tap-target floor has to hold for that host too —
 * it is stated in the recipe, not in the component.
 *
 * The font-size profile is a plain `--font-sizes-*` override on the wrapper,
 * because that is exactly how a host retunes the scale. Passing it lets the
 * test prove the floor holds at the larger profiles too — the failure it
 * guards against is a height that emerges from padding plus text, which is
 * legal at one profile and not at another.
 */
export function MenuHarness({
  fontSize,
  labels = ["Dashboard", "Vitals", "Notes", "Sign out"],
}: {
  fontSize?: string;
  labels?: string[];
}) {
  const classes = menuRecipe();
  const style = fontSize
    ? ({ "--font-sizes-md": fontSize } as React.CSSProperties)
    : undefined;
  return (
    <div style={{ width: "100%", fontSize: "var(--font-sizes-md, 1rem)", ...style }}>
      <ul role="menu" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {labels.map((label) => (
          <li key={label} role="menuitem" className={classes.item}>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MenuHarness;
