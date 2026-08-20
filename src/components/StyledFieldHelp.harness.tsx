import React from "react";
import { styled } from "styled-system/jsx";
import StyledFieldHelp from "./StyledFieldHelp";
import StyledFormLabel from "./StyledFormLabel";
import StyledText from "./StyledText";
import { StonedogStyleProvider } from "../config/style-config";

/**
 * Mount targets for `StyledFieldHelp.ct.tsx` and
 * `StyledFieldHelp.contrast.ct.tsx`.
 *
 * A separate module because Playwright resolves a mounted component by import,
 * and because a spec may only mount once — so anything that needs two things on
 * screen at the same time has to be one fixture.
 *
 * ## The three surfaces exist for the contrast measurement, not for variety
 *
 * Inline help is smaller than the text around it and is painted in a muted
 * colour, which is precisely the combination that fails WCAG 1.4.3 quietly. The
 * only honest measurement is against **the surface the text actually paints
 * on**, and in a real product that is rarely the page:
 *
 * | fixture | what the text sits on |
 * |---|---|
 * | `HelpOnPage` | the page itself — the easy case, and the only one a naive check looks at |
 * | `HelpOnCard` | an opaque panel in the theme's own colour |
 * | `HelpOnTintedChip` | a **translucent** chip composited over that panel |
 *
 * The third is the shape that produced a confidently wrong pass elsewhere in
 * this fleet: the checker read the page background, the text was on a tinted
 * chip over a dark card, and the reported ratio described a rendering nobody
 * ever saw. Every fixture uses the same words so the only variable is the
 * surface.
 */

const HELP_TEXT = "Milligrams per tablet, as printed on the bottle.";

/** An opaque panel in the theme's own surface colour — the ordinary card. */
const Card = styled("div", {
  base: {
    background: "boxBgPrimary",
    color: "textPrimary",
    padding: "1rem",
  },
});

/**
 * A translucent tint over whatever it is placed on.
 *
 * `color-mix` with `transparent` rather than a flat colour, which is how the
 * status surfaces in this package's own preset are defined — so this is the
 * real shape, not a contrived one. Nothing here can be measured by reading a
 * single element's `background-color`.
 */
const TintedChip = styled("div", {
  base: {
    background: "color-mix(in srgb, {colors.boxBgSecondary} 40%, transparent)",
    padding: "0.75rem",
  },
});

/** Label → help → control, the order the whole design depends on. */
function Field({ id, label }: { id: string; label: string }) {
  return (
    <>
      <StyledFormLabel htmlFor={id}>{label}</StyledFormLabel>
      <StyledFieldHelp htmlFor={id}>{HELP_TEXT}</StyledFieldHelp>
      <input id={id} data-testid={`control-${id}`} />
    </>
  );
}

/** Help on the bare page. */
export function HelpOnPage() {
  return (
    <div data-testid="surface-page">
      <Field id="dose" label="Dose" />
    </div>
  );
}

/** Help on an opaque themed panel. */
export function HelpOnCard() {
  return (
    <Card data-testid="surface-card">
      <Field id="dose" label="Dose" />
    </Card>
  );
}

/** Help on a translucent chip, itself on an opaque themed panel. */
export function HelpOnTintedChip() {
  return (
    <Card data-testid="surface-card">
      <TintedChip data-testid="surface-chip">
        <Field id="dose" label="Dose" />
      </TintedChip>
    </Card>
  );
}

/**
 * A short form — two controls, each explained.
 *
 * This is the fixture the tab-order assertion runs against, and the count is
 * the assertion: two controls must mean two tab stops. The pattern this
 * replaces would have made it four.
 */
export function ExplainedForm() {
  return (
    <form>
      <Field id="dose" label="Dose" />
      <Field id="unit" label="Unit" />
    </form>
  );
}

/** The same help under two text-size profiles. */
export function SizedHelp() {
  return (
    <div>
      <StonedogStyleProvider fontSizeProfile="sm">
        <StyledFieldHelp htmlFor="small" data-testid="help-sm">
          {HELP_TEXT}
        </StyledFieldHelp>
        <input id="small" />
      </StonedogStyleProvider>
      <StonedogStyleProvider fontSizeProfile="xl">
        <StyledFieldHelp htmlFor="large" data-testid="help-xl">
          {HELP_TEXT}
        </StyledFieldHelp>
        <input id="large" />
      </StonedogStyleProvider>
    </div>
  );
}

/** Help beside ordinary body text, so the size step can be measured. */
export function HelpBesideText() {
  return (
    <StonedogStyleProvider fontSizeProfile="md">
      <div>
        <StyledText data-testid="body">Take one tablet each morning.</StyledText>
        <StyledFieldHelp htmlFor="dose" data-testid="help">
          {HELP_TEXT}
        </StyledFieldHelp>
        <input id="dose" />
      </div>
    </StonedogStyleProvider>
  );
}

/** The lowest profile the host can select — where the size clamp matters. */
export function SmallestProfileHelp() {
  return (
    <StonedogStyleProvider fontSizeProfile="xs">
      <div>
        <StyledText data-testid="body">Take one tablet each morning.</StyledText>
        <StyledFieldHelp htmlFor="dose" data-testid="help">
          {HELP_TEXT}
        </StyledFieldHelp>
        <input id="dose" />
      </div>
    </StonedogStyleProvider>
  );
}

/** A long line of help in a full-width container, for the wrapping check. */
export function LongHelp() {
  return (
    <div style={{ width: "100%" }} data-testid="wrapper">
      <StyledFormLabel htmlFor="dose">Dose</StyledFormLabel>
      <StyledFieldHelp htmlFor="dose" data-testid="help">
        Enter the number of milligrams in a single tablet, exactly as it is
        printed on the bottle the pharmacy dispensed, including any decimal
        point.
      </StyledFieldHelp>
      <input id="dose" style={{ width: "100%" }} />
    </div>
  );
}

