import React from "react";
import StyledTabs from "./StyledTabs";
import StyledText from "./StyledText";
import { StonedogStyleProvider } from "../config/style-config";
import type { FontSizeProfile } from "../config/types";

/** Mount targets for StyledTabs.ct.tsx. */

const TABS = [
  { value: "passkeys", label: "Passkeys" },
  { value: "sessions", label: "Sessions" },
  { value: "history", label: "History" },
];

export function TabsHarness({
  initial = "passkeys",
  profile,
}: {
  initial?: string;
  profile?: FontSizeProfile;
}) {
  const [value, setValue] = React.useState(initial);
  const tabs = (
    <>
      <StyledTabs.List
        tabs={TABS}
        value={value}
        onValueChange={setValue}
        ariaLabel="Security sections"
        idPrefix="security"
        data-testid="tablist"
      />
      <StyledTabs.Panel idPrefix="security" value={value} data-testid="panel">
        <StyledText>Panel for {value}</StyledText>
      </StyledTabs.Panel>
    </>
  );
  if (!profile) return tabs;
  return (
    <StonedogStyleProvider fontSizeProfile={profile}>
      {tabs}
    </StonedogStyleProvider>
  );
}

/**
 * The same list at two profiles, side by side, so one mount answers "does the
 * reader's setting reach the label" without depending on a remount.
 */
export function TabsAtTwoProfiles() {
  return (
    <>
      <StonedogStyleProvider fontSizeProfile="xs">
        <StyledTabs.List
          tabs={TABS}
          value="passkeys"
          onValueChange={() => {}}
          ariaLabel="Small"
          idPrefix="small"
        />
      </StonedogStyleProvider>
      <StonedogStyleProvider fontSizeProfile="xl">
        <StyledTabs.List
          tabs={TABS}
          value="passkeys"
          onValueChange={() => {}}
          ariaLabel="Large"
          idPrefix="large"
        />
      </StonedogStyleProvider>
    </>
  );
}

/**
 * A narrow container, to force the wrap the list is built for. 320px is the
 * WCAG 1.4.10 reflow width.
 *
 * **The labels are deliberately longer than `TABS`'.** Measured first:
 * "Passkeys / Sessions / History" all three fit on one row at 320px, so a wrap
 * assertion against them failed at all four viewports — the list was correct
 * and the fixture proved nothing about wrapping. These are the kind of label a
 * settings screen really carries, and they do not fit.
 */
const LONG_TABS = [
  { value: "passkeys", label: "Passkeys and devices" },
  { value: "sessions", label: "Active sessions" },
  { value: "history", label: "Sign-in history" },
];

export function TabsInANarrowBox() {
  return (
    <div style={{ width: "320px" }} data-testid="narrow">
      <StyledTabs.List
        tabs={LONG_TABS}
        value="passkeys"
        onValueChange={() => {}}
        ariaLabel="Narrow"
        idPrefix="narrow"
      />
    </div>
  );
}

/**
 * The control for the test above: three short labels in the same 320px box,
 * which genuinely do fit on one row. Without it, "the list does not overflow"
 * would be equally true of a list that overflowed and was clipped.
 */
export function ShortTabsInANarrowBox() {
  return (
    <div style={{ width: "320px" }} data-testid="narrow-short">
      <StyledTabs.List
        tabs={TABS}
        value="passkeys"
        onValueChange={() => {}}
        ariaLabel="Narrow short"
        idPrefix="short"
      />
    </div>
  );
}

export default TabsHarness;
