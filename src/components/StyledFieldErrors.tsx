"use client";

import React from "react";
import { css } from "styled-system/css";
import StyledAlert from "./StyledAlert";

/**
 * One validation failure.
 *
 * `path` is the field it belongs to, as segments — `["address", "postcode"]`.
 * An array rather than a dotted string because that is the shape every
 * validator already produces, and joining is lossy in the one case that
 * matters: a key containing a dot becomes indistinguishable from nesting.
 */
export interface FieldError {
  path: ReadonlyArray<string | number>;
  message: string;
}

export interface StyledFieldErrorsProps {
  errors: ReadonlyArray<FieldError>;
  /** Heading above the list. */
  title?: React.ReactNode;
  className?: string;
}

/**
 * A summary of validation failures.
 *
 * ```tsx
 * <StyledFieldErrors errors={result.error.issues} />
 * ```
 *
 * ## Renamed from `StyledZodErrorDisplay`, and that is the whole point
 *
 * The component it replaces took `z.ZodIssue[]`, which put **zod in the
 * dependency list of a design system** — imposed on every consumer, including
 * ones that validate with something else or not at all (NEH-430).
 *
 * Nothing about rendering a list of field errors is zod-specific. `FieldError`
 * is structurally what `ZodIssue` already is for these purposes, so a zod host
 * passes `result.error.issues` **unchanged** — `ZodIssue` has both `path` and
 * `message` — and a yup/valibot/hand-rolled host maps two fields. The rename is
 * not cosmetic: `StyledZodErrorDisplay` is a name that tells every reader the
 * package knows about zod, which is the thing being removed.
 *
 * ## Two behaviours that deliberately differ from the original
 *
 * **It is not dismissible.** The original carried a `dismissed` state and an
 * effect resetting it whenever `errors` changed. A summary the user can dismiss
 * while the errors are still there — and while the submit button still refuses
 * — is a way to hide the explanation for a form that will not submit. If a host
 * wants that, it can conditionally render this component, which is clearer at
 * the call site than a hidden state inside it.
 *
 * **It paints from tokens, not from `red.*`.** The original used `red.50` /
 * `red.200` / `red.900/30` and a `_dark` block, which is a literal palette
 * colour: right in one theme, wrong in every other, and invisible to the
 * contrast floor. This delegates to `StyledAlert status="error"`, so it inherits
 * the error tokens, the `role="alert"` announcement, and the non-colour glyph.
 */
export const StyledFieldErrors = React.forwardRef<
  HTMLDivElement,
  StyledFieldErrorsProps
>(function StyledFieldErrors(
  { errors, title = "Please fix the following:", className },
  ref,
) {
  // Nothing to say, so say nothing. Rendering an empty alert would announce
  // itself to a screen reader — `role="alert"` is an assertive live region —
  // and interrupt the user to tell them about no problems.
  if (errors.length === 0) return null;

  return (
    <StyledAlert
      ref={ref}
      status="error"
      title={title}
      {...(className !== undefined ? { className } : {})}
    >
      <ul className={css({ listStyle: "disc", paddingInlineStart: "5" })}>
        {errors.map((error, index) => (
          // The path is part of the key because two fields commonly fail the
          // same rule with the same message ("Required"), and a message-only
          // key would collide. The index is the tail-breaker for the case where
          // one field carries two failures.
          <li key={`${error.path.join(".")}-${index}`}>{error.message}</li>
        ))}
      </ul>
    </StyledAlert>
  );
});

export default StyledFieldErrors;
