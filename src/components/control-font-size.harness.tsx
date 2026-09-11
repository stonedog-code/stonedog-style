import React from "react";
import StyledAlert from "./StyledAlert";
import StyledButton from "./StyledButton";
import StyledIconButton from "./StyledIconButton";
import StyledTable from "./StyledTable";
import StyledTag from "./StyledTag";
import StyledText from "./StyledText";
import { StonedogStyleProvider } from "../config/style-config";
import type { FontSizeProfile } from "../config/types";

/**
 * The five controls plus the two reference texts, at one profile.
 *
 * It lives here rather than in `control-font-size.ct.tsx` because Playwright's
 * component runner refuses to mount a component declared inside a test file —
 * the test runs in Node and the component has to be importable by the browser
 * bundle. Harness files are excluded from the published tarball, so this costs
 * consumers nothing.
 *
 * `body` is `StyledText` at the profile and `one-down` is `StyledText
 * size="sm"`, which is what "a step quieter than the sentence" means. Every
 * assertion in the spec compares a control against one of those two, so none of
 * them encodes a pixel value or a particular host ramp.
 */
export const CONTROL_ICON_SIZES = ["1x", "sm", "md", "lg"] as const;

export function ControlFontSizeHarness({ profile }: { profile: FontSizeProfile }) {
  return (
    <StonedogStyleProvider fontSizeProfile={profile}>
      <div>
        <StyledText data-testid="body">body</StyledText>
        <StyledText size="sm" data-testid="one-down">
          one down
        </StyledText>

        <StyledButton data-testid="button">Save</StyledButton>
        {CONTROL_ICON_SIZES.map((size) => (
          <StyledIconButton
            key={size}
            size={size}
            data-testid={`icon-${size}`}
            tooltip="Star"
          >
            <span>*</span>
          </StyledIconButton>
        ))}
        <StyledTag data-testid="tag" onRemove={() => {}}>
          Draft
        </StyledTag>
        <StyledAlert data-testid="alert" title="Title">
          message
        </StyledAlert>
        <StyledTable data-testid="table">
          <tbody>
            <tr>
              <td data-testid="cell">cell</td>
            </tr>
          </tbody>
        </StyledTable>
      </div>
    </StonedogStyleProvider>
  );
}

/**
 * Every control with `fixedSize`, at one profile.
 *
 * Separate from the harness above because `fixedSize` is the assertion most
 * likely to be broken by an over-application of this fix, and mixing pinned and
 * relative controls in one tree makes a locator mistake read as a pass.
 */
export function FixedSizeControlHarness({ profile }: { profile: FontSizeProfile }) {
  return (
    <StonedogStyleProvider fontSizeProfile={profile}>
      <div>
        <StyledButton fixedSize data-testid="button">
          Save
        </StyledButton>
        <StyledIconButton fixedSize data-testid="icon" tooltip="Star">
          <span>*</span>
        </StyledIconButton>
        <StyledTag fixedSize data-testid="tag">
          Draft
        </StyledTag>
        <StyledAlert fixedSize data-testid="alert" title="Title">
          message
        </StyledAlert>
        <StyledTable fixedSize data-testid="table">
          <tbody>
            <tr>
              <td data-testid="cell">cell</td>
            </tr>
          </tbody>
        </StyledTable>
      </div>
    </StonedogStyleProvider>
  );
}

/** A pinned tag beside a relative one, to prove the pin is not accidental. */
export function PinnedVsRelativeTagHarness({ profile }: { profile: FontSizeProfile }) {
  return (
    <StonedogStyleProvider fontSizeProfile={profile}>
      <div>
        <StyledTag fixedSize data-testid="pinned">
          Draft
        </StyledTag>
        <StyledTag data-testid="relative">Draft</StyledTag>
      </div>
    </StonedogStyleProvider>
  );
}
