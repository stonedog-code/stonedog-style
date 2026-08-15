"use client";

import React from "react";
import { css, cx } from "styled-system/css";
import { tagRecipe } from "styled-system/recipes";
import type { AlertStatus } from "./StyledAlert";

/**
 * A tag's tone.
 *
 * The four status names ARE `AlertStatus`, referenced rather than retyped, so
 * the package cannot drift into two status vocabularies — a green that means
 * "success" on a banner and "active" on a tag is the kind of divergence nobody
 * notices until a product has both.
 *
 * `neutral` and `accent` extend it. `neutral` is the historical appearance and
 * stays the default; `accent` exists because a tag is frequently just a
 * *category* — a type, a group, a label — and forcing those into `info` would
 * make "informational" mean nothing.
 */
export type TagTone = "neutral" | AlertStatus | "accent";

export interface StyledTagProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "onSelect"> {
  children: React.ReactNode;
  /**
   * The tag's colour, carrying meaning.
   *
   * ## Colour must not be the only signal (WCAG 1.4.1, Level A)
   *
   * Usually it is not, and that is why there is no forced glyph here: a tag
   * generally *is* its label, so `<StyledTag tone="success">Enabled</StyledTag>`
   * says "enabled" in words and the colour merely reinforces it. `StyledAlert`
   * needs a glyph because a banner's status is genuinely carried by its
   * colouring; a tag's is carried by its text.
   *
   * **The exception is a tag whose label does not name its own state** — a
   * feature name tinted green for on and grey for off, say. There the colour is
   * the only signal and the criterion is unmet, so pass `indicator`.
   */
  tone?: TagTone;
  /**
   * A non-colour signal rendered before the label.
   *
   * Deliberately not defaulted per tone. See `tone` above: defaulting one would
   * put a glyph on every tag in every consumer to fix the minority of cases
   * where the label does not already say what the colour says.
   */
  indicator?: React.ReactNode;
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
    {
      children,
      tone = "neutral",
      indicator,
      onRemove,
      removeLabel = "Remove",
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <span
        ref={ref}
        /*
         * The recipe, not an inline `css()` — see `preset/recipes/tag.ts`. A
         * tone computed at runtime (`tone={STATUS_COLOR[status]}`) is invisible
         * to Panda's extractor, and `staticCssRecipes` is what covers it.
         */
        className={cx(tagRecipe({ tone }), className)}
        {...rest}
      >
        {indicator !== undefined && <span aria-hidden="true">{indicator}</span>}
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
