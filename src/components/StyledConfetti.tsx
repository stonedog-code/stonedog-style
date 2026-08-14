"use client";

import React from "react";
import { css, cx } from "styled-system/css";

/** What a celebration is asked for. */
export interface CelebrateOptions {
  /** How many pieces to throw. */
  particleCount: number;
  /** Render these characters instead of coloured pieces. */
  emojis?: ReadonlyArray<string> | undefined;
}

/**
 * A host's own celebration.
 *
 * This is the seam that replaced a `js-confetti` import (NEH-430). A host that
 * wants that library — or canvas-confetti, or a Lottie animation — passes a
 * function; everyone else gets the CSS burst below.
 *
 * It may return a promise, in which case `onComplete` fires when it settles.
 * A rejection is deliberately NOT propagated: a celebration that fails is not
 * an error the user needs, and the surrounding flow (a save, a signup) has
 * already succeeded by the time anything fires confetti.
 */
export type CelebrateFn = (
  options: CelebrateOptions,
) => void | Promise<unknown>;

/** How long the default burst runs, in ms. Also the `onComplete` delay. */
const BURST_MS = 1200;

/**
 * Tokens the default burst cycles through.
 *
 * Theme tokens rather than literal colours, so a celebration is on-brand and
 * follows dark mode — and so this component does not become the one place in
 * the package that knows a hex value.
 */
const PARTICLE_TOKENS = [
  "boxBgAccent",
  "boxBgPrimary",
  "boxBgSecondary",
  "textAccent",
] as const;

/**
 * One pre-built class per particle colour.
 *
 * These are written out as four literal `css()` calls rather than generated in
 * the render loop, and that is a requirement rather than a style preference:
 * **Panda extracts styles by parsing source statically**, so
 * `css({ backgroundColor: token })` — with `token` a variable — resolves to
 * nothing and emits no rule, while the class name still lands in the DOM. The
 * particles would be invisible, with no build error and nothing in the console.
 * It is the same trap the CLAUDE.md note about `width={metrics.mark}` records.
 */
const PARTICLE_CLASS: Record<(typeof PARTICLE_TOKENS)[number], string> = {
  boxBgAccent: css({ backgroundColor: "boxBgAccent" }),
  boxBgPrimary: css({ backgroundColor: "boxBgPrimary" }),
  boxBgSecondary: css({ backgroundColor: "boxBgSecondary" }),
  textAccent: css({ backgroundColor: "textAccent" }),
};

interface Particle {
  id: number;
  dx: string;
  dy: string;
  rot: string;
  delay: string;
  token: (typeof PARTICLE_TOKENS)[number];
  emoji: string | undefined;
}

function buildParticles(
  count: number,
  emojis: ReadonlyArray<string> | undefined,
): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i += 1) {
    // Upward-biased spread: real confetti is thrown up and falls, so a
    // symmetric circle reads as an explosion rather than a celebration.
    const angle = Math.PI + Math.random() * Math.PI;
    const distance = 80 + Math.random() * 160;
    particles.push({
      id: i,
      dx: `${Math.cos(angle) * distance}px`,
      dy: `${Math.sin(angle) * distance}px`,
      rot: `${Math.random() * 720 - 360}deg`,
      delay: `${Math.random() * 150}ms`,
      token: PARTICLE_TOKENS[i % PARTICLE_TOKENS.length]!,
      emoji: emojis && emojis.length > 0 ? emojis[i % emojis.length] : undefined,
    });
  }
  return particles;
}

/** Whether the user has asked for less motion. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface StyledConfettiProps {
  /** Rising edge fires the celebration. Falling edge re-arms it. */
  trigger?: boolean;
  particleCount?: number;
  emojis?: ReadonlyArray<string> | undefined;
  /** Swap in a host implementation — see `CelebrateFn`. */
  celebrate?: CelebrateFn | undefined;
  /** Fires when the celebration has finished, however it was rendered. */
  onComplete?: (() => void) | undefined;
}

/**
 * A celebration, fired by a rising edge on `trigger`.
 *
 * ```tsx
 * <StyledConfetti trigger={saved} onComplete={() => setSaved(false)} />
 * ```
 *
 * ## The default is a real burst, not a no-op
 *
 * The component this replaces imported `js-confetti` — a dependency on every
 * consumer for a decoration three call sites use. The seam is `celebrate`; the
 * default is a CSS-only burst of themed particles, which needs no canvas, no
 * library, and no host wiring.
 *
 * A no-op default was the other option the issue offered and would have been
 * the weaker one: "nothing happens" is indistinguishable from "the seam is
 * broken", and it is the reading someone reaches for first.
 *
 * ## It honours `prefers-reduced-motion`, and by skipping rather than shortening
 *
 * Confetti is purely decorative — it carries no information — which is exactly
 * the category a reduced-motion preference is about. So when the preference is
 * set the burst does not play at all, and **`onComplete` still fires**. That
 * second half matters more than it looks: hosts commonly use `onComplete` to
 * reset the trigger, so swallowing it would leave the flag stuck true and the
 * celebration permanently armed.
 *
 * The check is deliberately made at fire time rather than subscribed to. A
 * user changing the preference mid-burst is not worth a listener, and reading
 * it during render would make the component's output differ between server and
 * first client paint.
 */
export const StyledConfetti: React.FC<StyledConfettiProps> = ({
  trigger = false,
  particleCount = 60,
  emojis,
  celebrate,
  onComplete,
}) => {
  const [particles, setParticles] = React.useState<Particle[] | null>(null);
  const hasFired = React.useRef(false);

  // The callback is held in a ref so it is not a dependency of the effect
  // below. A host writing `onComplete={() => setSaved(false)}` inline passes a
  // new function every render, which as a dependency would re-run the effect
  // and re-fire the burst on every parent render.
  const onCompleteRef = React.useRef(onComplete);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  React.useEffect(() => {
    if (!trigger) {
      // Falling edge re-arms, so the same component can celebrate twice.
      hasFired.current = false;
      return;
    }
    if (hasFired.current) return;
    hasFired.current = true;

    if (celebrate !== undefined) {
      const result = celebrate({ particleCount, emojis });
      if (result && typeof (result as Promise<unknown>).then === "function") {
        // The SAME handler on both arms, rather than `.finally()`.
        //
        // Two things have to be true at once. A host implementation that
        // rejects must still release the trigger — `onComplete` is what a host
        // resets its flag in, so skipping it leaves the celebration armed for
        // ever and nothing can fire again. And the rejection must be
        // *consumed*: `.finally()` returns a promise that rejects onward, so it
        // would satisfy the first requirement while emitting an unhandled
        // rejection into the host's console for a decoration that failed. A
        // two-armed `.then` does both.
        void (result as Promise<unknown>).then(
          () => onCompleteRef.current?.(),
          () => onCompleteRef.current?.(),
        );
      } else {
        onCompleteRef.current?.();
      }
      return;
    }

    if (prefersReducedMotion()) {
      onCompleteRef.current?.();
      return;
    }

    setParticles(buildParticles(particleCount, emojis));
    const timer = setTimeout(() => {
      setParticles(null);
      onCompleteRef.current?.();
    }, BURST_MS);

    return () => clearTimeout(timer);
  }, [trigger, particleCount, emojis, celebrate]);

  if (particles === null) return null;

  return (
    <div
      data-testid="styled-confetti"
      // Decoration, and nothing else. `aria-hidden` because there is nothing
      // here to announce, and `pointer-events: none` because a celebration
      // that swallows the click on the button underneath it is a real bug.
      aria-hidden="true"
      className={css({
        position: "fixed",
        inset: "0",
        pointerEvents: "none",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        zIndex: "50",
      })}
    >
      {particles.map((p) => (
        <span
          key={p.id}
          data-testid="styled-confetti-particle"
          className={cx(
            css({
              gridArea: "1 / 1",
              width: "8px",
              height: "8px",
              borderRadius: "sm",
              animation: "stonedogConfettiBurst 1.2s ease-out forwards",
            }),
            // Omitted for an emoji particle: the glyph is the decoration, and a
            // coloured square behind it is not.
            p.emoji === undefined ? PARTICLE_CLASS[p.token] : undefined,
          )}
          style={
            {
              // Per-particle values feeding the shared keyframe. See the
              // keyframe's own comment for why these are custom properties and
              // why they are not the theme namespace.
              "--sd-confetti-dx": p.dx,
              "--sd-confetti-dy": p.dy,
              "--sd-confetti-rot": p.rot,
              animationDelay: p.delay,
              // An emoji particle is a glyph, so it must not also be a coloured
              // square behind that glyph.
              ...(p.emoji !== undefined
                ? { fontSize: "1.5rem", width: "auto", height: "auto" }
                : {}),
            } as React.CSSProperties
          }
          {...(p.emoji === undefined
            ? { "data-particle-token": p.token }
            : {})}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
};

export default StyledConfetti;
