import { css } from "styled-system/css";

/**
 * The elements a stack may render as (NEH-1868, 0.36.0).
 *
 * A union of intrinsic names rather than `React.ElementType`, so an
 * unsupported one is a TYPE error at the call site instead of a silent
 * `<div as="…">` at runtime. That silent attribute is exactly how
 * `<StyledStack as="ul">` shipped for months: `StyledVStack` never read `as`,
 * the props type (inherited from `StyledHStack`) accepted it, and every `<li>`
 * inside was orphaned under a `<div>`.
 *
 * Every entry is a container whose children may legitimately be laid out as
 * flex items (`label` is `StyledInputBool`'s own root). Add one when a real
 * call site needs it, not speculatively.
 */
export type StackElement =
  | "div"
  | "section"
  | "article"
  | "aside"
  | "nav"
  | "header"
  | "footer"
  | "main"
  | "form"
  | "label"
  | "ul"
  | "ol"
  | "li";

/**
 * A stack is layout, not a bulleted list, so `ul`/`ol` drop the user-agent's
 * markers, indent and block margin. Hosts on Panda's preflight already reset
 * these and see no change; a host without a reset (this package sets
 * `preflight: false`) would otherwise get a 40px indent and bullets the caller
 * never asked for. Each is a default: a caller's own `listStyle`, `p`/`px`/…,
 * or `mt`/`mb` still wins (`StyledHStack`/`StyledVStack` merge these BEFORE
 * the caller's props, and the component test measures that).
 *
 * Written as a literal so Panda's static extractor emits the three classes.
 */
export const listStackReset = css.raw({ listStyle: "none", margin: "0", padding: "0" });

export function isListElement(element: StackElement): element is "ul" | "ol" {
  return element === "ul" || element === "ol";
}
