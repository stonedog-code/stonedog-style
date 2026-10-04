"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { styled } from "styled-system/jsx";
import { css, cx } from "styled-system/css";
import { buttonRecipe } from "styled-system/recipes";
import type { AllowedVariant } from "../config/types";
import StyledButton from "./StyledButton";
import StyledText from "./StyledText";
import StyledField from "./StyledField";
import StyledInputText from "./StyledInputText";
import { useDisclosure } from "./useDisclosure";

/**
 * A destructive action that asks first, in place: the trigger opens a small
 * panel beneath it — what will happen, optionally a body of the caller's own
 * controls and a step-up code, and Cancel / Confirm.
 *
 * ```tsx
 * <StyledInlineConfirm
 *   triggerLabel="Remove organisation"
 *   prompt="Remove Acme Ltd? Its filings and reminders are deleted, and this cannot be undone."
 *   confirmLabel="Remove Acme Ltd"
 *   onConfirm={() => removeEntity(id)}
 * />
 * ```
 *
 * ## What the hand-rolled versions kept getting wrong (NEH-1817)
 *
 * - **Focus fell to `<body>`.** Swapping the trigger out for the panel
 *   destroys the focused element, so a keyboard or screen-reader user is
 *   thrown to the top of the document mid-decision. Here the trigger stays
 *   mounted (it carries `aria-expanded`), focus moves INTO the panel on open,
 *   and returns to the trigger on Cancel or Escape.
 * - **The destructive button looked like every other button.** Confirm is
 *   painted with the error pairing `StyledAlert` uses — `boxError` surface,
 *   `textError` text, `borderError` edge, all three measured together for AA
 *   in both themes there — so it does not borrow the primary action's
 *   colour. Its LABEL is the main signal, and it should name the act
 *   ("Remove Acme Ltd"), not say "OK".
 * - **Some had no confirmation at all**, which is the argument for this being
 *   cheap enough to always use.
 *
 * ## Cancel comes first, and takes the focus
 *
 * "Focus to the first control" with Cancel first means a reader who presses
 * Enter twice — once to open, once out of habit — has cancelled, not
 * destroyed. With a step-up code the code field comes first instead, which
 * is the same guarantee: the second Enter cannot reach Confirm.
 *
 * ## Built on `useDisclosure`
 *
 * The panel is a disclosure: `aria-expanded` / `aria-controls` on the trigger,
 * and the panel `hidden` rather than unmounted while closed. Using the hook
 * rather than re-deriving it is what keeps this and every other disclosure in
 * the package agreeing.
 *
 * ## The body slot (NEH-1852, 0.36.0)
 *
 * `children` render between the prompt and the step-up field — a reason
 * field, an "email the board" checkbox, the typed account name a deletion
 * asks for. They are the CALLER's controlled state: this component renders
 * them and nothing more, so `onConfirm` reads their values from wherever the
 * caller keeps them. With a body, focus on open lands on the body's FIRST
 * focusable control rather than Cancel; a body with nothing focusable (a
 * paragraph of consequences) falls back to the panel's first control, as
 * before. Escape and Cancel still return focus to the trigger.
 *
 * ## The step-up slot
 *
 * `stepUp` adds a code field wired through `StyledField`. An empty code is
 * refused with a message, never by disabling Confirm — a disabled button
 * explains nothing and is skipped by Tab. `stepUpError` shows the host's own
 * verdict ("That code did not match").
 *
 * **The keyboard is TEXT by default, as of 0.36.0 (NEH-1858).** Before it the
 * field was hard-coded `inputMode="numeric"`, and a step-up commonly accepts a
 * recovery code with letters or the account password — which a phone's digit
 * keypad cannot type. A wrong numeric default locks a reader out; a wrong text
 * default costs a TOTP-only host one keyboard switch. `stepUp.inputMode =
 * "numeric"` restores the old keypad for a host that accepts digits only.
 * `stepUp.autoComplete` defaults to `"one-time-code"`.
 */

export interface StyledInlineConfirmStepUp {
  /** The field's visible label — "Verification code". */
  label: string;
  /** Where the code comes from. */
  help?: React.ReactNode;
  /** Said when Confirm is pressed with the field empty. */
  emptyMessage?: string;
  /**
   * The virtual keyboard. Default `"text"` (0.36.0, NEH-1858) — a step-up may
   * accept a recovery code with letters or a password. Pass `"numeric"` when
   * the field takes digits only.
   */
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] | undefined;
  /**
   * The field's `autocomplete` token. Default `"one-time-code"`; a field that
   * takes the account password says `"current-password"`.
   */
  autoComplete?: string | undefined;
}

export interface StyledInlineConfirmProps {
  /** The trigger's visible text — the act, "Delete account". */
  triggerLabel: React.ReactNode;
  /** What will happen, in a sentence. Names the panel to assistive technology. */
  prompt: React.ReactNode;
  /** Default `"Confirm"`. Prefer naming the act: "Delete account". */
  confirmLabel?: React.ReactNode;
  /** Default `"Cancel"`. */
  cancelLabel?: React.ReactNode;
  /**
   * Runs on Confirm. May return a promise: Confirm shows its busy state until
   * it settles, and the panel closes (focus back to the trigger) when it
   * resolves. A rejection leaves the panel open so the reader can retry or
   * cancel — say what failed through `stepUpError` or the host's own message.
   */
  onConfirm: (details: { code?: string }) => void | Promise<void>;
  /** Called when the reader cancels (button or Escape). */
  onCancel?: () => void;
  /** `"destructive"` (default) or `"neutral"` for a confirmation that destroys nothing. */
  tone?: "destructive" | "neutral";
  /** The trigger's appearance. Follows the app-wide variant when omitted. */
  triggerVariant?: AllowedVariant | undefined;
  /** Add a one-time-code field the reader must fill first. */
  stepUp?: StyledInlineConfirmStepUp | undefined;
  /** The host's verdict on the last code — shown as the field's error. */
  stepUpError?: React.ReactNode;
  /** What Confirm says while `onConfirm` is pending. Default `"Working"`. */
  busyLabel?: React.ReactNode;
  /**
   * The body (NEH-1852, 0.36.0): rendered between the prompt and the step-up
   * field. Focus on open lands on its first focusable control. Its values are
   * the caller's own state; read them in `onConfirm`.
   */
  children?: React.ReactNode;
  /** Prefix for `data-testid`s: `-trigger`, `-panel`, `-body`, `-confirm`, `-cancel`, `-code`. */
  "data-testid"?: string | undefined;
}

/**
 * Confirm's destructive paint, as a utility class over `buttonRecipe`.
 *
 * Utilities outrank the recipe, so these hold in every state — hover does not
 * repaint the surface into the variant's ordinary colours. The pair is the
 * one `StyledAlert status="error"` paints and `alert.ct.tsx` measures; hover
 * and focus thicken the edge instead of changing colour, so no state
 * introduces an unmeasured pairing.
 */
const destructiveClass = css({
  backgroundColor: "boxError",
  color: "textError",
  borderWidth: "2px",
  borderStyle: "solid",
  borderColor: "borderError",
  fontWeight: "bold",
  _hover: { boxShadow: "inset 0 0 0 2px {colors.borderError}" },
  _focusVisible: {
    outline: "3px solid",
    outlineColor: "borderError",
    outlineOffset: "2px",
  },
});

const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "3",
    marginTop: "2",
    padding: "3",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "borderBgPrimary",
    borderRadius: "md",
    backgroundColor: "boxBgPrimary",
    color: "textPrimary",
    maxWidth: "100%",
    // `display: flex` would otherwise beat the UA's `[hidden]` rule.
    "&[hidden]": { display: "none" },
  },
});

const Body = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "3" },
});

const Actions = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "2" },
});

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function StyledInlineConfirm({
  triggerLabel,
  prompt,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  tone = "destructive",
  triggerVariant,
  stepUp,
  stepUpError,
  busyLabel = "Working",
  children,
  "data-testid": testId = "inline-confirm",
}: StyledInlineConfirmProps) {
  const { open, setOpen, triggerProps, contentProps } = useDisclosure();
  const promptId = `${useId()}-prompt`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);
  const hasBody = children !== undefined && children !== null && children !== false;
  const [code, setCode] = useState("");
  const [emptyCode, setEmptyCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const wasOpen = useRef(false);

  // Into the panel on open; it is `hidden` until this render commits, and a
  // hidden element cannot take focus — hence an effect, not the click handler.
  useEffect(() => {
    if (open && !wasOpen.current) {
      // The body's first control when there is one (NEH-1852); otherwise the
      // panel's first — the code field, or Cancel.
      const target =
        bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  const closeToTrigger = () => {
    setOpen(false);
    setCode("");
    setEmptyCode(false);
    triggerRef.current?.focus();
  };

  const cancel = () => {
    onCancel?.();
    closeToTrigger();
  };

  const confirm = async () => {
    if (stepUp && code.trim() === "") {
      setEmptyCode(true);
      // The code field by ref: with a body, the panel's first `input` may be
      // the caller's, not this one.
      codeRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await onConfirm(stepUp ? { code: code.trim() } : {});
      // The trigger may be gone — the thing it removed may have been its row.
      // Focusing a detached node is a no-op, and the host then owns focus.
      closeToTrigger();
      setBusy(false);
    } catch {
      // Stay open: the reader can retry or cancel. The host says what failed.
      // Busy disabled Confirm, which drops focus; put it back once enabled.
      setBusy(false);
      requestAnimationFrame(() => confirmRef.current?.focus());
    }
  };

  const codeError = emptyCode
    ? (stepUp?.emptyMessage ?? "Enter the code to continue.")
    : stepUpError;

  return (
    <div data-testid={testId}>
      <StyledButton
        ref={triggerRef}
        {...triggerProps}
        {...(triggerVariant !== undefined ? { variant: triggerVariant } : {})}
        data-testid={`${testId}-trigger`}
      >
        {triggerLabel}
      </StyledButton>
      <Panel
        ref={panelRef}
        {...contentProps}
        role="group"
        aria-labelledby={promptId}
        data-testid={`${testId}-panel`}
        onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
      >
        <StyledText id={promptId} block>
          {prompt}
        </StyledText>
        {hasBody && (
          <Body ref={bodyRef} data-testid={`${testId}-body`}>
            {children}
          </Body>
        )}
        {stepUp && (
          <StyledField
            label={stepUp.label}
            help={stepUp.help}
            error={codeError}
            required
          >
            <StyledInputText
              ref={codeRef}
              value={code}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setCode(event.target.value);
                if (emptyCode) setEmptyCode(false);
              }}
              onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void confirm();
                }
              }}
              autoComplete={stepUp.autoComplete ?? "one-time-code"}
              inputMode={stepUp.inputMode ?? "text"}
              data-testid={`${testId}-code`}
            />
          </StyledField>
        )}
        <Actions>
          <StyledButton
            type="button"
            variant="outline"
            onClick={cancel}
            data-testid={`${testId}-cancel`}
          >
            {cancelLabel}
          </StyledButton>
          <StyledButton
            ref={confirmRef}
            type="button"
            // `StyledButton` sets the recipe class itself and a caller's
            // `className` REPLACES it, so the destructive layer is passed
            // together with the recipe it sits on — otherwise the 48px floor
            // and the rest of the box would go with it.
            {...(tone === "destructive"
              ? {
                  variant: "outline" as const,
                  className: cx(buttonRecipe({ variant: "outline" }), destructiveClass),
                }
              : {})}
            loading={busy}
            loadText={busyLabel}
            onClick={() => void confirm()}
            data-tone={tone}
            data-testid={`${testId}-confirm`}
          >
            {confirmLabel}
          </StyledButton>
        </Actions>
      </Panel>
    </div>
  );
}

StyledInlineConfirm.displayName = "StyledInlineConfirm";

export default StyledInlineConfirm;
