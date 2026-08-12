import React from "react";
import { css } from "styled-system/css";

/**
 * Mount target for `emphasis.ct.tsx`.
 *
 * Deliberately plain: a `<div>` painting `boxBgMain`/`textMain`, with three
 * spans inside it at the three emphasis levels. The tiers are defined relative
 * to the *inherited* colour, so what has to be under test is ordinary
 * inheritance — wrapping them in a component that sets its own `color` would
 * test the component instead.
 */
export function EmphasisHarness({ surface = "boxBgMain", base = "textMain" }) {
  return (
    <div
      data-testid="surface"
      className={css({ padding: "4" })}
      style={{
        background: `var(--colors-${surface === "boxBgMain" ? "box-bg-main" : "box-bg-primary"})`,
        color: `var(--colors-${base === "textMain" ? "text-main" : "text-primary"})`,
      }}
    >
      <span data-testid="normal">Normal</span>{" "}
      <span data-testid="muted" className={css({ color: "textMuted" })}>
        Muted
      </span>{" "}
      <span data-testid="subtle" className={css({ color: "textSubtle" })}>
        Subtle
      </span>
    </div>
  );
}

export default EmphasisHarness;
