import { createToaster, DEFAULT_DURATIONS } from "../toaster-store";

/**
 * The toast queue.
 *
 * The assertions worth having here are the ones about invariants a reader would
 * "tidy up" without noticing: that `getSnapshot` is reference-stable (breaking
 * it is an infinite render loop, not a failed assertion), that the per-type
 * durations are the measured ones rather than a round number someone liked, and
 * that a dismissed toast lingers long enough to animate out.
 *
 * `src/components/__tests__/toaster-store.ssr.test.ts` covers the server half,
 * which needs a different Jest environment and therefore a different file.
 */
describe("createToaster — the queue", () => {
  it("holds a created toast and hands back its id", () => {
    const toaster = createToaster();
    const id = toaster.create({ title: "Saved.", type: "success" });

    const [toast] = toaster.getSnapshot();
    expect(toast?.id).toBe(id);
    expect(toast?.title).toBe("Saved.");
    expect(toast?.type).toBe("success");
    expect(toast?.dismissed).toBe(false);
  });

  it("defaults the type to info rather than to nothing", () => {
    const toaster = createToaster();
    toaster.create({ title: "FYI" });
    expect(toaster.getSnapshot()[0]?.type).toBe("info");
  });

  it("puts the newest toast first", () => {
    const toaster = createToaster();
    toaster.create({ title: "first" });
    toaster.create({ title: "second" });

    expect(toaster.getSnapshot().map((t) => t.title)).toEqual([
      "second",
      "first",
    ]);
  });

  describe("getSnapshot reference stability", () => {
    // useSyncExternalStore compares snapshots by identity. A getSnapshot that
    // built a fresh array per call would return a new value every render and
    // React would re-render forever — a hang, with no failing assertion
    // anywhere to explain it.
    it("returns the identical reference when nothing has changed", () => {
      const toaster = createToaster();
      expect(toaster.getSnapshot()).toBe(toaster.getSnapshot());

      toaster.create({ title: "one" });
      const afterCreate = toaster.getSnapshot();
      expect(toaster.getSnapshot()).toBe(afterCreate);
    });

    it("returns a NEW reference once something has changed", () => {
      // The other direction: a store that never changed identity would be
      // reference-stable and also never re-render. Both halves, or the
      // assertion above proves nothing.
      const toaster = createToaster();
      const before = toaster.getSnapshot();
      toaster.create({ title: "one" });
      expect(toaster.getSnapshot()).not.toBe(before);
    });

    it("agrees with the server snapshot when empty", () => {
      const toaster = createToaster();
      expect(toaster.getServerSnapshot()).toEqual(toaster.getSnapshot());
      expect(toaster.getServerSnapshot()).toBe(toaster.getServerSnapshot());
    });
  });

  describe("durations", () => {
    it.each(Object.keys(DEFAULT_DURATIONS) as Array<keyof typeof DEFAULT_DURATIONS>)(
      "gives a %s toast its own default",
      (type) => {
        const toaster = createToaster();
        toaster.create({ title: "x", type });
        expect(toaster.getSnapshot()[0]?.duration).toBe(DEFAULT_DURATIONS[type]);
      },
    );

    it("keeps success shorter than the rest, and loading unbounded", () => {
      // Spelled out rather than left implicit in the table above: these two are
      // the values a rewrite is most likely to flatten into one number.
      expect(DEFAULT_DURATIONS.success).toBe(2000);
      expect(DEFAULT_DURATIONS.loading).toBe(Infinity);
      expect(DEFAULT_DURATIONS.error).toBe(5000);
    });

    it("lets an explicit duration win", () => {
      const toaster = createToaster();
      toaster.create({ title: "x", type: "success", duration: 90000 });
      expect(toaster.getSnapshot()[0]?.duration).toBe(90000);
    });
  });

  describe("creating with an id that is already on screen", () => {
    it("updates in place instead of stacking a duplicate", () => {
      const toaster = createToaster();
      toaster.create({ id: "upload", title: "Uploading…", type: "loading" });
      toaster.create({ id: "upload", title: "Uploaded.", type: "success" });

      const snapshot = toaster.getSnapshot();
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0]?.title).toBe("Uploaded.");
      expect(snapshot[0]?.type).toBe("success");
      expect(snapshot[0]?.duration).toBe(DEFAULT_DURATIONS.success);
    });

    it("brings a toast back that was on its way out", () => {
      const toaster = createToaster({ removeDelay: 1000 });
      toaster.create({ id: "upload", title: "Uploading…" });
      toaster.remove("upload");
      expect(toaster.getSnapshot()[0]?.dismissed).toBe(true);

      toaster.create({ id: "upload", title: "Uploading again…" });
      expect(toaster.getSnapshot()[0]?.dismissed).toBe(false);
    });
  });

  describe("overflow", () => {
    it("holds back everything past max and admits it as room appears", () => {
      const toaster = createToaster({ max: 2, removeDelay: 0 });
      toaster.create({ id: "a", title: "a" });
      toaster.create({ id: "b", title: "b" });
      toaster.create({ id: "c", title: "c" });

      expect(toaster.getSnapshot().map((t) => t.id)).toEqual(["b", "a"]);

      toaster.remove("a");
      expect(toaster.getSnapshot().map((t) => t.id)).toEqual(["c", "b"]);
    });

    it("admits an error ahead of a confirmation", () => {
      // A failure nobody sees is the expensive one. Only consulted past `max`,
      // which is why the test has to force the queue to build up.
      const toaster = createToaster({ max: 1, removeDelay: 0 });
      toaster.create({ id: "blocker", title: "blocker" });
      toaster.create({ id: "ok", title: "ok", type: "success" });
      toaster.create({ id: "bad", title: "bad", type: "error" });

      toaster.remove("blocker");
      expect(toaster.getSnapshot()[0]?.id).toBe("bad");
    });

    it("drops a queued toast that is removed before it is ever shown", () => {
      const toaster = createToaster({ max: 1, removeDelay: 0 });
      toaster.create({ id: "blocker", title: "blocker" });
      toaster.create({ id: "never", title: "never" });

      toaster.remove("never");
      toaster.remove("blocker");
      expect(toaster.getSnapshot()).toHaveLength(0);
    });
  });

  describe("removal", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("marks the toast dismissed first and purges it after removeDelay", () => {
      // The gap is what the exit animation runs in. Purging immediately would
      // make a toast disappear rather than leave.
      const toaster = createToaster({ removeDelay: 200 });
      const id = toaster.create({ title: "Saved." });

      toaster.remove(id);
      expect(toaster.getSnapshot()).toHaveLength(1);
      expect(toaster.getSnapshot()[0]?.dismissed).toBe(true);

      jest.advanceTimersByTime(199);
      expect(toaster.getSnapshot()).toHaveLength(1);

      jest.advanceTimersByTime(1);
      expect(toaster.getSnapshot()).toHaveLength(0);
    });

    it("clears everything when called with no id", () => {
      const toaster = createToaster({ removeDelay: 200 });
      toaster.create({ title: "one" });
      toaster.create({ title: "two" });

      toaster.remove();
      expect(toaster.getSnapshot().every((t) => t.dismissed)).toBe(true);

      jest.advanceTimersByTime(200);
      expect(toaster.getSnapshot()).toHaveLength(0);
    });

    it("ignores a second removal of the same toast", () => {
      const toaster = createToaster({ removeDelay: 200 });
      const id = toaster.create({ title: "one" });
      const listener = jest.fn();
      toaster.subscribe(listener);

      toaster.remove(id);
      toaster.remove(id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("ignores an id it has never seen", () => {
      const toaster = createToaster();
      expect(() => toaster.remove("nonexistent")).not.toThrow();
    });
  });

  describe("subscription", () => {
    it("notifies on create and stops after unsubscribe", () => {
      const toaster = createToaster();
      const listener = jest.fn();
      const unsubscribe = toaster.subscribe(listener);

      toaster.create({ title: "one" });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      toaster.create({ title: "two" });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("survives a listener that unsubscribes itself while being notified", () => {
      // Iterating the live array would shorten it mid-loop and skip the next
      // listener — a subscriber silently stops updating, which on a toaster
      // means messages that never appear.
      const toaster = createToaster();
      const second = jest.fn();
      const unsubscribeFirst = toaster.subscribe(() => unsubscribeFirst());
      toaster.subscribe(second);

      toaster.create({ title: "one" });
      expect(second).toHaveBeenCalledTimes(1);
    });
  });
});
