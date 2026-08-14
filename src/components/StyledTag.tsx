"use client";

import React from "react";
import { css, cx } from "styled-system/css";

export interface StyledTagProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "onSelect"> {
  children: React.ReactNode;
  /**
   * Show a remove control, and call this when it is activated.
   *
   * Omitting it renders a plain, non-interactive tag — which is what the great
   * majority of call sites want. A tag that is merely a label should not be
   * focusable, and should not offer a button that does nothing.
   */
  onRemove?: (() => void) | undefined;
  /**
   * The remove button's accessible name.
   *
   * Defaults to `Remove` — deliberately generic, because the component cannot
   * see the label text as a string (children may be any node) and inventing
   * "Remove {children}" from a React tree produces "Remove [object Object]" as
   * often as it produces something useful. A call site with a plain text label
   * should pass the specific form; a list of tags all announcing "Remove" is
   * navigable but tedious.
   */
  removeLabel?: string;
}

/**
 * A small label, optionally removable.
 *
 * ```tsx
 * <StyledTag>Draft</StyledTag>
 * <StyledTag onRemove={() => drop(id)} removeLabel="Remove tag Draft">Draft</StyledTag>
 * ```
 *
 * ## Why this is a `<span>` and not a compound component
 *
 * The version this replaces was built on `@ark-ui/react`, which is what kept it
 * out of this package — a dependency imposed on every consumer, one of them a
 * proprietary SaaS and one AGPLv3.
 *
 * The judgement (NEH-430, and the same one the dropdown got) is that the
 * library buys interactive/dismissible behaviour that a span with a close
 * button also provides, and usually provides *more* accessibly, because there
 * is no reimplemented focus management to get wrong. A host that genuinely
 * needs the compound version composes it locally, at the one call site.
 */
export const StyledTag = React.forwardRef<HTMLSpanElement, StyledTagProps>(
  function StyledTag(
    { children, onRemove, removeLabel = "Remove", className, ...rest },
    ref,
  ) {
    return (
      <span
        ref={ref}
        className={cx(
          css({
            display: "inline-flex",
            alignItems: "center",
            gap: "1",
            paddingInline: "2",
            // Vertical padding is deliberately absent: the height comes from
            // the line box and the horizontal padding, so a tag tracks the
            // font scale instead of needing a re-tune whenever it moves.
            borderRadius: "md",
            backgroundColor: "boxBgSecondary",
            color: "textSecondary",
            // Not a tap target: a plain tag is not interactive, so the 48px
            // floor does not apply to it. The remove BUTTON below is, and does.
            fontSize: "sm",
            whiteSpace: "nowrap",
          }),
          className,
        )}
        {...rest}
      >
        <span>{children}</span>
        {onRemove !== undefined && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            className={css({
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              // The house floor, stated rather than left to emerge from
              // padding — see CLAUDE.md. A remove control inside a small tag is
              // exactly where a hit area silently shrinks below it.
              minWidth: "48px",
              minHeight: "48px",
              // The visible glyph stays small while the hit area does not, so
              // the tag does not become 48px tall to hold its own button.
              marginBlock: "-3",
              marginInlineEnd: "-2",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "inherit",
            })}
          >
            {/*
              `aria-hidden` so the button announces its `aria-label` alone. A
              multiplication sign, not a letter x: it is the correct glyph and
              a screen reader that ignores the hiding reads "times" rather
              than "x", which at least is not a letter of the label.
            */}
            <span aria-hidden="true">×</span>
          </button>
        )}
      </span>
    );
  },
);

export default StyledTag;
