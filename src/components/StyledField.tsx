"use client";

import React, { useId } from "react";
import { styled } from "styled-system/jsx";
import { useResolvedFontSize } from "../config/style-config";
import StyledFormLabel from "./StyledFormLabel";
import StyledFieldHelp, { fieldHelpId } from "./StyledFieldHelp";
import StyledFieldset from "./StyledFieldset";

/**
 * One form field, wired: a visible label, optional help, the control, and an
 * error — with the ids, `aria-describedby`, `aria-invalid` and `required`
 * that make them one thing to assistive technology rather than four nearby
 * things.
 *
 * ```tsx
 * <StyledField label="Email" help="We send receipts here." error={errors.email} required>
 *   <StyledInputText type="email" name="email" />
 * </StyledField>
 *
 * <StyledField label="Send me reminders" kind="checkbox">
 *   <input type="checkbox" name="reminders" />
 * </StyledField>
 *
 * <StyledField label="Billing cycle" kind="group" error={errors.cycle} required>
 *   <StyledInputRadio items={cycles} value={cycle} onChange={…} name="cycle" />
 * </StyledField>
 * ```
 *
 * ## Why a composite, when every part already exists (NEH-1817)
 *
 * `StyledFormLabel`, `StyledFieldHelp` and an error message each work. What
 * kept going wrong was the wiring between them, re-done by hand at every
 * form: a textarea whose error is not in its `aria-describedby`, a select with
 * no `aria-invalid`, a checkbox whose only name is a placeholder. Each looks
 * fine and announces as an unexplained, unlabelled control. So this composes
 * the existing parts and owns only the wiring — it is not a fourth label.
 *
 * ## The control slot
 *
 * `children` is either ONE element, which is cloned with the wiring props, or
 * a function that receives them and spreads them where they belong:
 *
 * ```tsx
 * <StyledField label="Notes">{(control) => <MyEditor {...control} />}</StyledField>
 * ```
 *
 * Every input in this package forwards those props to its DOM element, so the
 * element form is the common one. The function form exists for a control that
 * does not forward them — a cloned prop a child drops is a silent failure, and
 * the function makes the hand-off visible at the call site. A `describedby`
 * the child already carries is kept and extended, never replaced.
 *
 * | `kind` | label | the wiring goes on |
 * |---|---|---|
 * | `"control"` (default) | `<label for>` above | the input / textarea / select |
 * | `"checkbox"` | `<label for>` beside the box | the checkbox |
 * | `"group"` | `<legend>` of a `<fieldset>` | the fieldset is described; the child gets `aria-invalid` / `aria-required` (a radio group carries both) |
 *
 * ## The error container is always in the DOM
 *
 * It is a `role="alert"` region rendered empty when there is no error, so
 * that an error appearing is a CHANGE to an existing live region — the case
 * screen readers announce reliably. A region mounted together with its text
 * is announced inconsistently, and that inconsistency is exactly how "I
 * pressed save and nothing happened" reaches a support inbox. The control's
 * `aria-describedby` names it only while it has something to say.
 *
 * ## Required is announced by the control, and SHOWN by the label
 *
 * `required` sets the native attribute (or `aria-required` on a group), which
 * is what assistive technology announces; the label's asterisk is then
 * `aria-hidden`, because an announced "star" on top of "required" is noise.
 * That pairing is the one `StyledFormLabel` documents, and this component is
 * what guarantees both halves are present together.
 */

/** The `id` of a field's error message, derived from the control's id. */
export function fieldErrorId(controlId: string): string {
  return `${controlId}-error`;
}

/** What a control in the slot receives. Spread it onto the element with the role. */
export interface FieldControlProps {
  /** Absent for `kind="group"` — the fieldset carries the id there. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  /** The native attribute, for an input, textarea, select or checkbox. */
  required?: true;
  /** For `kind="group"`, where no native `required` exists. */
  "aria-required"?: true;
}

export type FieldKind = "control" | "checkbox" | "group";

export interface StyledFieldProps {
  /** The visible name. Never a placeholder's job. */
  label: React.ReactNode;
  /** One element to wire, or a function given the wiring props. See above. */
  children:
    | React.ReactElement
    | ((control: FieldControlProps) => React.ReactNode);
  kind?: FieldKind | undefined;
  /**
   * The control's id (the fieldset's, for a group). Generated when omitted;
   * supply one when something else must name the control.
   */
  id?: string | undefined;
  /** Permanent help, rendered by `StyledFieldHelp`. */
  help?: React.ReactNode;
  /**
   * The current error. Anything renderable; empty, `false` or absent means
   * none. Sets `aria-invalid` and joins `aria-describedby` while present.
   */
  error?: React.ReactNode;
  required?: boolean | undefined;
  /** Append a muted "(optional)" to the label. */
  optional?: boolean | undefined;
  className?: string | undefined;
  "data-testid"?: string | undefined;
}

const FieldRoot = styled("div", {
  base: { display: "block", width: "100%", minWidth: 0 },
});

/** The checkbox row: the box, then its label, sharing one baseline. */
const CheckboxRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "2",
    // A checkbox and its label together are the target; the floor is the
    // row's, so a 14px native box still sits in a 48px-tall hit area.
    minHeight: "48px",
    "& > label": { marginBottom: "0" },
  },
});

const FieldError = styled("p", {
  base: {
    display: "block",
    marginTop: "2",
    marginBottom: "0",
    marginInline: "0",
    color: "textError",
    fontWeight: "bold",
    lineHeight: "1.4",
    // Empty, it must take no room: it is mounted before there is anything to
    // say (see above), and a permanent gap under every field is the cost of
    // getting that wrong.
    "&:empty": { marginTop: "0" },
  },
});

function hasContent(node: React.ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== "";
}

function joinIds(...ids: Array<string | undefined | null>): string | undefined {
  const tokens = ids
    .flatMap((value) => (value ? value.split(/\s+/) : []))
    .filter(Boolean);
  const unique = Array.from(new Set(tokens));
  return unique.length > 0 ? unique.join(" ") : undefined;
}

export function StyledField({
  label,
  children,
  kind = "control",
  id,
  help,
  error,
  required,
  optional,
  className,
  "data-testid": testId,
}: StyledFieldProps) {
  const generated = useId();
  const controlId = id ?? `field-${generated}`;
  const helpId = fieldHelpId(controlId);
  const errorId = fieldErrorId(controlId);
  const fontSize = useResolvedFontSize({});

  const hasHelp = hasContent(help);
  const hasError = hasContent(error);
  const describedBy = joinIds(hasHelp ? helpId : undefined, hasError ? errorId : undefined);

  const controlProps: FieldControlProps = {
    ...(kind === "group" ? {} : { id: controlId }),
    ...(hasError ? { "aria-invalid": true as const } : {}),
    ...(required
      ? kind === "group"
        ? { "aria-required": true as const }
        : { required: true as const }
      : {}),
    // A group's description belongs to the fieldset, which is what a screen
    // reader announces on entering it; repeating it on the child would read it
    // twice.
    ...(kind !== "group" && describedBy ? { "aria-describedby": describedBy } : {}),
  };

  let control: React.ReactNode;
  if (typeof children === "function") {
    control = children(controlProps);
  } else {
    const own = (children.props as { "aria-describedby"?: string })["aria-describedby"];
    const merged = joinIds(own, controlProps["aria-describedby"]);
    control = React.cloneElement(children, {
      ...controlProps,
      ...(merged ? { "aria-describedby": merged } : {}),
    } as Partial<unknown>);
  }

  const helpNode = hasHelp ? (
    <StyledFieldHelp htmlFor={controlId}>{help}</StyledFieldHelp>
  ) : null;

  const errorNode = (
    <FieldError
      id={errorId}
      role="alert"
      data-field-error="true"
      style={{ fontSize }}
    >
      {hasError ? (
        <>
          {/* A glyph as well as the colour, so the error never rests on
              colour alone; hidden, because the words already say it. */}
          <span aria-hidden="true">⚠ </span>
          {error}
        </>
      ) : null}
    </FieldError>
  );

  if (kind === "group") {
    return (
      <StyledFieldset
        variant="unstyled"
        id={controlId}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        {...(className !== undefined ? { className } : {})}
        data-testid={testId}
      >
        <StyledFieldset.Legend
          paddingX="0"
          marginBottom="2"
          color="textPrimary"
          style={{ fontSize }}
        >
          {label}
          {required && (
            <styled.span color="textError" marginLeft="0.25em" aria-hidden="true">
              *
            </styled.span>
          )}
          {optional && (
            <>
              {" "}
              <styled.span fontWeight="normal" color="textSecondary" fontSize="0.95em">
                (optional)
              </styled.span>
            </>
          )}
        </StyledFieldset.Legend>
        {helpNode}
        {control}
        {errorNode}
      </StyledFieldset>
    );
  }

  const labelNode = (
    <StyledFormLabel
      htmlFor={controlId}
      {...(required ? { required: true } : {})}
      {...(optional ? { optional: true } : {})}
    >
      {label}
    </StyledFormLabel>
  );

  return (
    <FieldRoot
      {...(className !== undefined ? { className } : {})}
      data-testid={testId}
    >
      {kind === "checkbox" ? (
        <CheckboxRow>
          {control}
          {labelNode}
        </CheckboxRow>
      ) : (
        <>
          {labelNode}
          {helpNode}
          {control}
        </>
      )}
      {kind === "checkbox" ? helpNode : null}
      {errorNode}
    </FieldRoot>
  );
}

StyledField.displayName = "StyledField";

export default StyledField;
