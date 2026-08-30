"use client";

/**
 * `"use client"`, and it is load-bearing.
 *
 * This component calls `useFontSizeProfile()` (a client hook) during its
 * render. Without the directive above, the module is a Server Component in a
 * consumer's App Router tree, the hook is invoked on the server, and React
 * throws:
 *
 *     Attempted to call useFontSizeProfile() from the server but
 *     useFontSizeProfile is on the client.
 *
 * Next serves that as its blank "This page couldn't load" page with no detail
 * anywhere in the browser, so a consumer sees a dead route and nothing naming
 * this component. Every PRD and how-to page on stonedogcode.com was unreachable
 * this way (NEH-1290).
 *
 * Every other component here that calls the hook already declared it — this was
 * the only one that did not, which is why the failure looked like something
 * specific to whichever page happened to render a heading on the server.
 *
 * `src/components/__tests__/client-directive.test.ts` keeps this honest. It has
 * to be a source assertion: a jsdom render imports the module directly, so no
 * RSC boundary exists and every test here passes with or without the directive.
 */

import React from "react";
import StyledSeparator from "./StyledSeparator";
import StyledText from "./StyledText";
import { useFontSizeProfile } from "../config/style-config";
import { stepUpFontSize } from "../config/font-size";
import type { FontSizeKey } from "../config/types";
import type { HTMLStyledProps } from "styled-system/jsx";

type SizeKey = FontSizeKey;

type StyledHeadingProps = HTMLStyledProps<"h1"> & {
  addSeparator?: boolean;
  size?: SizeKey;
  as?: React.ElementType;
  fixedSize?: boolean;
  color?: string;
  ellipsis?: boolean;
  wrap?: boolean;
};

const StyledHeading = React.forwardRef<HTMLElement, StyledHeadingProps>(
  (
    {
      children,
      addSeparator,
      size,
      as = "h1",
      fixedSize,
      color,
      ellipsis = false,
      wrap = true,
      ...rest
    },
    ref,
  ) => {
    const fontSizeProfile = useFontSizeProfile();
    let baseSize: SizeKey;
    if (size) {
      baseSize = size;
    } else if (fixedSize) {
      baseSize = "md";
    } else {
      baseSize = fontSizeProfile;
    }

    // A heading reads one tier above whatever body text is currently set to,
    // so the hierarchy survives every font-size profile rather than only the
    // default one. Clamped at the top of the scale by stepUpFontSize.
    const headingSize = stepUpFontSize(baseSize);

    return (
      <>
        <StyledText
          as={as}
          ref={ref}
          size={headingSize}
          // The theme's heading face, so a theme can pair a display face with
          // its body face (NEH-289). Asked for here rather than in textRecipe
          // because StyledHeading shares that recipe with body copy. Written as
          // a literal so Panda's extractor, which only reads source text, sees
          // it.
          fontFamily="heading"
          fontWeight="bold"
          fixedSize={fixedSize}
          color={color}
          ellipsis={ellipsis}
          wrap={wrap}
          {...rest}
        >
          {children}
        </StyledText>
        {addSeparator && <StyledSeparator />}
      </>
    );
  },
);

StyledHeading.displayName = "StyledHeading";
export default StyledHeading;
