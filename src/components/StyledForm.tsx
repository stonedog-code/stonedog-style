"use client";

import React from "react";
import { css, cx } from "styled-system/css";
import StyledFieldErrors, { type FieldError } from "./StyledFieldErrors";

export interface StyledFormProps
  extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  /**
   * Validation failures to summarise above the fields.
   *
   * `FieldError[]`, not `z.ZodIssue[]` — which is the whole reason this
   * component can live here. A zod host passes `result.error.issues`
   * unchanged; see `StyledFieldErrors`.
   */
  errors?: ReadonlyArray<FieldError>;
  /** Heading for the error summary. */
  errorsTitle?: React.ReactNode;
}

/**
 * A form with a validation summary above its fields.
 *
 * ```tsx
 * <StyledForm errors={issues} onSubmit={handleSubmit}>
 *   <StyledInputText … />
 * </StyledForm>
 * ```
 *
 * ## It renders a real `<form>`, which the original did not
 *
 * The component this replaces rendered a `StyledBox` — a `<div>`. That is not
 * a cosmetic difference:
 *
 * - **Enter does not submit a div.** Pressing Enter in a text input submits the
 *   form it belongs to; in a div it does nothing, so every such form needed a
 *   pointer.
 * - **Assistive technology loses the form role**, and with it the ability to
 *   navigate by form.
 * - **`required`, `type="email"` and friends do nothing** without a form to
 *   validate against, which is the native validation the seam strategy for this
 *   component leans on.
 *
 * The summary is rendered *before* the fields deliberately: a summary below the
 * inputs is one a keyboard user reaches only after passing everything it is
 * telling them about.
 */
export const StyledForm = React.forwardRef<HTMLFormElement, StyledFormProps>(
  function StyledForm(
    { children, errors, errorsTitle, className, ...rest },
    ref,
  ) {
    return (
      <form
        ref={ref}
        className={cx(
          css({ display: "flex", flexDirection: "column", gap: "3" }),
          className,
        )}
        {...rest}
      >
        {errors !== undefined && errors.length > 0 && (
          <StyledFieldErrors
            errors={errors}
            {...(errorsTitle !== undefined ? { title: errorsTitle } : {})}
          />
        )}
        {children}
      </form>
    );
  },
);

export default StyledForm;
