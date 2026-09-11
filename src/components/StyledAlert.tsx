"use client";

import React from "react";
import { alertRecipe } from "styled-system/recipes";
import { cx } from "styled-system/css";
import { useResolvedFontSize } from "../config/style-config";
import type { FontSizeKey } from "../config/types";

/** The four things an alert can be. */
export type AlertStatus = "info" | "success" | "warning" | "error";

/**
 * Which ARIA role each status takes, and why they are not all the same.
 *
 * The difference is whether the announcement **interrupts**. `alert` is an
 * assertive live region: a screen reader abandons what it was saying to read it.
 * That is right for a failure the user must deal with and wrong for a
 * confirmation — being interrupted mid-sentence to be told something worked is
 * hostile, and doing it for every status trains people to ignore the important
 * ones.
 *
 * The original component had **no role at all**, so none of the four was
 * announced. An alert that is not announced is not an alert (NEH-421).
 */
const ROLE_FOR_STATUS: Record<AlertStatus, "alert" | "status"> = {
  error: "alert",
  warning: "alert",
  info: "status",
  success: "status",
};

/**
 * The non-colour signal for each status — WCAG 1.4.1 (Use of Colour), Level A.
 *
 * The original conveyed status by background colour alone. The `Indicator` slot
 * existed and every call site left it empty, so the whole distinction was
 * invisible to anyone who cannot separate four pale washes — which includes
 * roughly one man in twelve, and anyone on a bad screen in daylight.
 *
 * These are text characters rather than icons on purpose. This package ships no
 * artwork by policy, and a glyph inherits `currentColor` and the font scale for
 * free, so the signal survives a font-size change and cannot end up a different
 * colour from the message beside it.
 *
 * They are `aria-hidden`: the role above already tells a screen reader what kind
 * of message this is, and reading "warning sign" before the text would be the
 * same information twice.
 */
const GLYPH_FOR_STATUS: Record<AlertStatus, string> = {
  info: "i",
  success: "✓",
  warning: "!",
  error: "✕",
};

export interface StyledAlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Which kind of message this is. Decides colour, glyph AND announcement. */
  status?: AlertStatus;
  /** Optional heading, shown above the message in bold. */
  title?: React.ReactNode;
  /**
   * Replace the built-in glyph.
   *
   * Pass a node to substitute your own icon, or `null` to render no indicator.
   * `null` is deliberately possible and deliberately awkward to reach for: it
   * puts the component back in breach of WCAG 1.4.1 unless the surrounding UI
   * carries the signal some other way.
   */
  indicator?: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Which step of the text scale the banner reads at.
   *
   * **Relative, exactly as on `StyledText`**, and the default is body size.
   *
   * The recipe set no `font-size` on `root`, `title` or `description`, and a
   * `<div>` inherits — which sounds like it follows the reader and does not. A
   * host defines `--font-sizes-*` at `:root` **statically**; the profile works
   * by selecting a different KEY, so a component that never names a key never
   * sees the setting. Worse, HopperGuard leaves the document at the browser's
   * 16px while pinning `--font-sizes-md` to 1.375rem, so an alert rendered
   * **22px smaller than the sentence above it** at the `xl` profile and 6px
   * smaller at the default one. Measured, at every profile, on both ramps: a
   * flat 16px.
   *
   * The two Optima products set `body { font-size: var(--font-sizes-md) }`, so
   * for them this changes nothing at `profile="md"` — the banner was already
   * reading the value it now names.
   */
  size?: FontSizeKey;
  /** Pin to the `md` step rather than following the reader's profile. */
  fixedSize?: boolean;
}

/**
 * A status banner.
 *
 * ```tsx
 * <StyledAlert status="error" title="Something went wrong">
 *   We could not save your changes.
 * </StyledAlert>
 * ```
 */
export const StyledAlert = React.forwardRef<HTMLDivElement, StyledAlertProps>(
  function StyledAlert(
    { status = "info", title, indicator, children, className, size, fixedSize, style, ...rest },
    ref,
  ) {
    const classes = alertRecipe({ status });
    /*
     * Set on the ROOT alone. The title, the description and the indicator are
     * all sized in `em` or inherit, so one declaration moves the whole banner
     * and none of its parts can drift out of proportion with the others.
     */
    const fontSize = useResolvedFontSize({ size, fixedSize });
    const glyph = indicator === undefined ? GLYPH_FOR_STATUS[status] : indicator;

    return (
      <div
        ref={ref}
        // `role` and `aria-live` together: the role carries the semantics, and
        // the explicit `aria-live` is what makes an alert rendered into an
        // already-present region announce when its CONTENT changes rather than
        // only when it mounts. A banner that swaps "saving" for "failed" in
        // place is the common case and the one that otherwise goes silent.
        role={ROLE_FOR_STATUS[status]}
        aria-live={ROLE_FOR_STATUS[status] === "alert" ? "assertive" : "polite"}
        className={cx(classes.root, className)}
        // A caller's own `style` spreads after ours, so it still wins outright.
        style={{ fontSize, ...style }}
        {...rest}
      >
        {glyph !== null && (
          <span aria-hidden="true" className={classes.indicator}>
            {glyph}
          </span>
        )}
        <div className={classes.content}>
          {title !== undefined && title !== null && (
            <div className={classes.title}>{title}</div>
          )}
          {children !== undefined && children !== null && (
            <div className={classes.description}>{children}</div>
          )}
        </div>
      </div>
    );
  },
);

export default StyledAlert;
