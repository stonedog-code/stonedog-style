/**
 * The toast queue: a subscribable store, with no React and no DOM in it.
 *
 * ## Why this is a store and not a component
 *
 * A toast is created from places that are not rendering — an event handler, a
 * `.catch()`, a module-level helper called before anything has mounted. So the
 * thing callers reach for cannot be a hook. It has to be a plain object with a
 * `create()` on it, and the component that draws toasts has to *subscribe* to
 * that object rather than own it.
 *
 * That shape is what `useSyncExternalStore` exists for, and the three methods
 * below (`subscribe`, `getSnapshot`, `getServerSnapshot`) are exactly its
 * contract. Two of its rules are easy to break and fail loudly but obscurely:
 *
 * - **`getSnapshot` must return the identical reference when nothing changed.**
 *   Returning a fresh array each call makes React re-render forever. `toasts`
 *   below is therefore replaced only on mutation, never rebuilt on read.
 * - **`getServerSnapshot` is mandatory** for anything server-rendered, and must
 *   also be reference-stable. `EMPTY` is a single frozen array shared by every
 *   call for that reason.
 *
 * ## Why `create()` does nothing on the server
 *
 * A module-level array lives for the lifetime of the Node process, not the
 * request. A toast created during SSR would therefore still be sitting in the
 * queue when the *next* user is served by that same instance — one person's
 * "Saved." announced to a stranger. There is no request boundary available here
 * to scope it to, and a toast has no meaning without a browser to show it in,
 * so the honest answer is to refuse to queue one at all.
 *
 * `create()` still returns the id it would have used, so a caller that stores
 * or logs the result behaves identically in both environments.
 *
 * ## Timers are deliberately NOT here
 *
 * Auto-dismiss lives in the renderer, per toast, starting when that toast first
 * mounts. Putting it here would start the clock at `create()` time — so a toast
 * fired before the toaster mounted (a redirect, a slow hydration, a `create()`
 * in a module body) could expire before it was ever drawn. It would look like
 * the toast was silently dropped, which is the failure this whole component is
 * most likely to be blamed for and least likely to be caught doing.
 *
 * What *is* here is the exit delay, because it is a property of leaving the
 * queue rather than of being on screen: `remove()` marks a toast `dismissed`
 * and purges it `removeDelay` ms later, so the renderer has a state to animate
 * out of.
 */

import type { ReactNode } from "react";

/**
 * The kinds of toast, matching what the extracted application already used.
 *
 * `default` is a toast with no status at all — no accent, no glyph. It is not a
 * synonym for `info`; a message that means something should say which thing it
 * means.
 */
export type ToastType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "loading"
  | "default";

/** A single button on a toast. Rendered after the message. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /**
   * Supply one to make `create()` idempotent — creating with an id that is
   * already on screen updates that toast in place rather than stacking a
   * duplicate. Useful for progress ("Uploading…" → "Uploaded").
   */
  id?: string | undefined;
  title?: ReactNode;
  description?: ReactNode;
  type?: ToastType | undefined;
  /**
   * Milliseconds on screen. Omit to use the per-type default below.
   * `Infinity` pins the toast until it is dismissed.
   */
  duration?: number | undefined;
  action?: ToastAction | undefined;
  /** Render a close control. */
  closable?: boolean | undefined;
}

export interface Toast extends ToastOptions {
  id: string;
  type: ToastType;
  duration: number;
  /**
   * Set the moment `remove()` is called and the toast starts animating out.
   * It stays in the snapshot while true so the renderer has something to
   * animate; it is purged `removeDelay` ms later.
   */
  dismissed: boolean;
}

export interface ToasterStoreOptions {
  /**
   * How many toasts may be on screen at once. Further ones wait in a queue and
   * are admitted as room appears.
   *
   * 24 is not a considered number — it is the value the store this replaces
   * used, kept so that the behaviour at overflow does not change silently along
   * with everything else.
   */
  max?: number;
  /** How long a dismissed toast stays in the snapshot so it can animate out. */
  removeDelay?: number;
}

export interface ToasterStore {
  /**
   * Show a toast. Returns its id.
   *
   * Named `create` rather than `show` or `toast` because that is the name the
   * 345 call sites in the application this was extracted from already use.
   */
  create: (options: ToastOptions) => string;
  /**
   * Dismiss one toast, or every toast when called with no argument.
   *
   * The toast animates out first — it is marked `dismissed` immediately and
   * leaves the snapshot `removeDelay` ms later.
   */
  remove: (id?: string) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => readonly Toast[];
  getServerSnapshot: () => readonly Toast[];
}

/**
 * How long each kind stays up, in milliseconds.
 *
 * These are not invented. They are the values `@zag-js/toast` uses, read out of
 * the installed package rather than guessed, so that swapping the
 * implementation underneath an application does not quietly retime every
 * message in it. Note `success` is much shorter than the rest — a confirmation
 * has been read the moment it is seen, whereas a warning is asking for a
 * decision.
 */
export const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 2000,
  error: 5000,
  warning: 5000,
  info: 5000,
  loading: Infinity,
  default: 5000,
};

/**
 * Which toast wins a place on screen when more than `max` are pending.
 *
 * Lower sorts first. Errors outrank confirmations because a failure the user
 * never sees is the expensive one, and within a type an *actionable* toast
 * outranks a passive one — there is nothing to miss on a toast with no button.
 *
 * Only consulted past `max` simultaneous toasts, which in practice means a loop
 * that has gone wrong. It exists so that what survives that is the half worth
 * reading.
 */
const PRIORITY: Record<ToastType, [actionable: number, passive: number]> = {
  error: [1, 2],
  warning: [3, 6],
  loading: [4, 5],
  success: [5, 7],
  info: [6, 8],
  default: [6, 8],
};

const priorityOf = (toast: Toast): number =>
  PRIORITY[toast.type][toast.action ? 0 : 1];

/**
 * One frozen array, returned by every server render and by any snapshot taken
 * of an empty store. `useSyncExternalStore` compares snapshots by reference, so
 * a fresh `[]` here would be a new value on every read.
 */
const EMPTY: readonly Toast[] = Object.freeze([]);

/** `window` is the only reliable "is there a user in front of this" signal. */
const inBrowser = (): boolean => typeof window !== "undefined";

export function createToaster(options: ToasterStoreOptions = {}): ToasterStore {
  const { max = 24, removeDelay = 200 } = options;

  let toasts: readonly Toast[] = EMPTY;
  let queued: Toast[] = [];
  let listeners: Array<() => void> = [];
  let counter = 0;

  /**
   * Ids are a counter, not a random or time-based value, so that a test can
   * assert on one and so two toasts created in the same millisecond cannot
   * collide. They are scoped to this store and never leave it.
   */
  const nextId = (): string => `toast-${++counter}`;

  const emit = (): void => {
    // Copied before iterating: a listener that unsubscribes itself while being
    // notified would otherwise shorten the array mid-loop and skip its
    // neighbour.
    for (const listener of [...listeners]) listener();
  };

  /** Admit queued toasts until the screen is full again. */
  const drain = (): void => {
    if (queued.length === 0 || toasts.length >= max) return;
    queued.sort((a, b) => priorityOf(a) - priorityOf(b));
    const admitted = queued.splice(0, max - toasts.length);
    // Queued toasts were created after everything on screen, so they go in
    // front; among themselves the highest priority leads.
    toasts = [...admitted, ...toasts];
  };

  const purge = (id: string): void => {
    const next = toasts.filter((toast) => toast.id !== id);
    if (next.length === toasts.length) return;
    toasts = next.length === 0 ? EMPTY : next;
    drain();
    emit();
  };

  const create = (options: ToastOptions): string => {
    const id = options.id ?? nextId();

    // See the header: never queue on the server.
    if (!inBrowser()) return id;

    const existing = toasts.find((toast) => toast.id === id);
    if (existing) {
      const type = options.type ?? existing.type;
      const updated: Toast = {
        ...existing,
        ...options,
        id,
        type,
        // A change of TYPE re-derives the duration, and that is the whole point
        // of this branch. The progress case — `loading` ("Uploading…") updated
        // in place to `success` ("Uploaded.") — carries no explicit duration,
        // and `loading` means `Infinity`. Simply keeping the old value leaves
        // the finished toast pinned to the screen forever, which reads as the
        // upload never having completed. Only an explicit `duration` overrides.
        duration:
          options.duration ??
          (type === existing.type ? existing.duration : DEFAULT_DURATIONS[type]),
        // Re-creating an id that is on its way out brings it back.
        dismissed: false,
      };
      toasts = toasts.map((toast) => (toast.id === id ? updated : toast));
      emit();
      return id;
    }

    const type = options.type ?? "info";
    const toast: Toast = {
      ...options,
      id,
      type,
      duration: options.duration ?? DEFAULT_DURATIONS[type],
      dismissed: false,
    };

    if (toasts.length >= max) {
      queued.push(toast);
      return id;
    }

    toasts = [toast, ...toasts];
    emit();
    return id;
  };

  const remove = (id?: string): void => {
    if (id === undefined) {
      queued = [];
      if (toasts.length === 0) return;
      toasts = toasts.map((toast) => ({ ...toast, dismissed: true }));
      emit();
      const ids = toasts.map((toast) => toast.id);
      schedulePurge(() => ids.forEach(purge));
      return;
    }

    const target = toasts.find((toast) => toast.id === id);
    if (!target) {
      // It may still be waiting for a slot; drop it before it ever appears.
      queued = queued.filter((toast) => toast.id !== id);
      return;
    }
    if (target.dismissed) return;

    toasts = toasts.map((toast) =>
      toast.id === id ? { ...toast, dismissed: true } : toast,
    );
    emit();
    schedulePurge(() => purge(id));
  };

  /**
   * The exit delay, skipped entirely off-browser.
   *
   * A `setTimeout` on the server would keep the event loop alive and fire into
   * a store nothing is subscribed to. There is nothing to animate there, so the
   * removal is immediate.
   */
  const schedulePurge = (run: () => void): void => {
    if (!inBrowser() || removeDelay <= 0) {
      run();
      return;
    }
    setTimeout(run, removeDelay);
  };

  return {
    create,
    remove,
    subscribe: (listener) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((candidate) => candidate !== listener);
      };
    },
    getSnapshot: () => toasts,
    getServerSnapshot: () => EMPTY,
  };
}
