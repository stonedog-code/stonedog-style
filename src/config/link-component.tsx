"use client";

import React from "react";

/**
 * The props any link implementation must accept.
 *
 * Deliberately the native anchor's own surface plus a required `href`. That is
 * not a compromise to keep the type simple — it is the boundary. A router's
 * link component accepts these and adds its own (prefetch, scroll, replace);
 * this package neither knows nor passes those, so the extra props stay the
 * host's business and no routing concept leaks in here.
 *
 * `href` is a `string`, not `string | UrlObject`. Next.js accepts the object
 * form, but naming it here would put a Next.js type in a package whose whole
 * premise is that it has none — and a host that wants the object form can wrap
 * its own component and take it there, which is exactly what the seam is for.
 */
export interface LinkComponentProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children?: React.ReactNode;
}

/**
 * What `StyledLink` renders for an in-app destination.
 *
 * A host swaps in its router's link — `next/link`, `react-router`'s `Link`,
 * whatever it has — and gets client-side navigation and prefetching. A host
 * that says nothing gets `DefaultLinkComponent` below.
 *
 * Typed as a component rather than an `ElementType` union so the intrinsic
 * `"a"` string is not a valid value. Allowing it would mean two ways to say the
 * same thing, and the one that looks simpler is the one that cannot be given a
 * `displayName` or wrapped.
 *
 * **It must forward its ref to the underlying anchor.** `RefAttributes` is in
 * the props type rather than left implicit because this package's peer range
 * starts at React 18, where a `ref` handed to a plain function component is not
 * a prop — React 18 drops it and logs "Function components cannot be given
 * refs". Stating it in the type is what makes that a compile error for the host
 * instead of a console warning nobody reads. `next/link` and react-router's
 * `Link` both forward already, so the common cases need nothing.
 */
export type LinkComponent = React.ComponentType<
  LinkComponentProps & React.RefAttributes<HTMLAnchorElement>
>;

/**
 * A plain anchor, and the reason this seam is safe to leave unconfigured.
 *
 * This is the point of the whole arrangement (NEH-430): the default is not a
 * placeholder that throws, warns, or renders nothing until someone wires a
 * router. It is a **real, correct, accessible link** — it navigates, it opens in
 * a new tab when told to, middle-click and "open in new window" work, and a
 * screen reader announces it as a link. What a host gains by overriding is
 * client-side navigation and prefetching: real benefits, and neither of them
 * load-bearing for the link *working*.
 *
 * A seam whose default is broken is a required configuration step wearing a
 * disguise, and it recreates exactly the adoption deadlock this issue set out
 * to remove.
 */
export const DefaultLinkComponent: LinkComponent = React.forwardRef<
  HTMLAnchorElement,
  LinkComponentProps
>(function DefaultLinkComponent(props, ref) {
  return <a ref={ref} {...props} />;
}) as LinkComponent;
