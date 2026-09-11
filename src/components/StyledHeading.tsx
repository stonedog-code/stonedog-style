"use client";

/**
 * `"use client"`, kept deliberately.
 *
 * It used to be load-bearing here for a reason worth recording: this component
 * called `useFontSizeProfile()` (a client hook) during its render, and without
 * the directive the module was a Server Component in a consumer's App Router
 * tree, the hook ran on the server, and React threw:
 *
 *     Attempted to call useFontSizeProfile() from the server but
 *     useFontSizeProfile is on the client.
 *
 * Next serves that as its blank "This page couldn't load" page with no detail
 * anywhere in the browser, so a consumer sees a dead route and nothing naming
 * this component. Every PRD and how-to page on stonedogcode.com was unreachable
 * this way (NEH-1290).
 *
 * **The hook call is gone as of NEH-1561** — a heading now hands `StyledText` a
 * relative offset and lets it read the profile, so nothing here touches a hook
 * and `client-directive.test.ts` no longer requires the directive on this file.
 * It stays anyway, because it costs nothing: everything this renders is
 * `StyledText`, which is a client component, so the subtree is client either
 * way. Deleting it would be a bundler-boundary change made as a side effect of
 * a font-size fix, which is exactly the kind of thing that gets found in
 * production rather than in review.
 *
 * `src/components/__tests__/client-directive.test.ts` keeps the rule honest for
 * the components that do still call hooks. It has to be a source assertion: a
 * jsdom render imports the module directly, so no RSC boundary exists and every
 * test here passes with or without the directive.
 */

import React from "react";
import StyledSeparator from "./StyledSeparator";
import StyledText from "./StyledText";
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
    /*
     * A heading reads one tier above whatever body text is currently set to,
     * so the hierarchy survives every font-size profile rather than only the
     * default one.
     *
     * This used to resolve the profile here and hand `StyledText` an ABSOLUTE
     * key. It cannot any more: since NEH-1561 a `size` prop IS an offset from
     * `md`, applied to the reader's profile inside `resolveFontSizeKey`, so
     * resolving the profile here as well would apply it twice — at
     * `profile="xl"` an unsized heading would have landed on `4xl` instead of
     * `2xl`, and the bug would have grown with the setting.
     *
     * The step goes down as `sizeStep` rather than as `stepUpFontSize(size)`,
     * and the difference is the clamp. Pre-stepping saturates at the top of the
     * key vocabulary, so `size="9xl"` would encode +10 instead of +11 and a
     * `9xl` heading would render the same size as the body text next to it —
     * its entire purpose gone. Summed as one offset and clamped once, it does
     * not.
     *
     * Nothing here reads the profile, which is why this component no longer
     * calls a hook.
     *
     * Verified unchanged at `profile="md"` for both branches: unsized renders
     * `lg` and `size="2xl"` renders `3xl`, exactly as before.
     */

    return (
      <>
        <StyledText
          as={as}
          ref={ref}
          size={size}
          sizeStep={1}
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
