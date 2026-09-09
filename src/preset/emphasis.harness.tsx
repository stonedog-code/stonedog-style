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

/**
 * An opaque themed panel with a **translucent** chip inside it (NEH-974).
 *
 * The third surface, and the only one whose background cannot be read off a
 * single element: the chip paints 40% of a token over something the chip knows
 * nothing about. Measuring the tiers here needs the whole ancestor chain
 * composited, which is what `emphasis.ct.tsx` does with a canvas.
 *
 * `color-mix` with `transparent` rather than a flat colour, because that is how
 * this package's own status surfaces are defined — the shape is real, not
 * contrived. Same fixture shape as `StyledFieldHelp.harness.tsx`, which does
 * the same thing for `textMuted` alone.
 */
export function EmphasisOnTintedChip() {
  return (
    <div
      data-testid="surface"
      className={css({ padding: "4" })}
      style={{
        background: "var(--colors-box-bg-primary)",
        color: "var(--colors-text-primary)",
      }}
    >
      <div
        data-testid="chip"
        className={css({ padding: "3" })}
        style={{
          background:
            "color-mix(in srgb, var(--colors-box-bg-secondary) 40%, transparent)",
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
    </div>
  );
}

export default EmphasisHarness;
