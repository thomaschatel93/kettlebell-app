'use client';

/* ---------------------------------------------------------------------------
   One stored value, one shared external store.

   Three screens now read three different stored values - the kit, the setup
   prefs and the workout in progress - and every one of them hits the same two
   problems, so the answer is written once here rather than three times.

   Why a store at all, rather than the usual `useState` + `useEffect` hydrate:
   localStorage does not exist while the server renders, so reading it during
   render splits the server and client renders apart and produces a hydration
   mismatch that jsdom never sees and a real phone always does. `useEffect` +
   `setState` fixes the mismatch but cascades an extra render, and Next 16's
   React Compiler ruleset rejects it outright:

     error  Calling setState synchronously within an effect can trigger
            cascading renders  react-hooks/set-state-in-effect

   `useSyncExternalStore` is the primitive for exactly this job: it handles the
   server render, the hydration render and every later change from one place.

   And why ONE store per key rather than a cache per screen: two screens each
   holding their own copy is two screens quietly disagreeing about which bells
   the user owns, because a write on one is invisible to the other until it
   remounts.
--------------------------------------------------------------------------- */

export interface LocalStore<T, P> {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => T | P;
  getServerSnapshot: () => T | P;
  /**
   * The only way to change the value. Writes through to storage first, so
   * nothing ever lives only in React state, then tells every mounted screen.
   *
   * Takes an updater as well as a value. Without one, two writes inside a
   * single JavaScript task clobber each other, because both read the same
   * snapshot before either lands - human-paced taps are safe, a programmatic
   * burst is not.
   *
   * Returns whether the write to storage actually succeeded. It can fail:
   * quota, or private mode. The in-memory snapshot is updated either way, so
   * the current session stays coherent, but a caller whose value MUST survive
   * a reload - the workout the next screen is about to read back - has to look
   * at this rather than assume.
   */
  publish: (next: T | ((previous: T) => T)) => boolean;
  /**
   * True once the real stored value is in hand, rather than the placeholder the
   * server render and the hydration render are given. Only those renders are
   * ever handed the placeholder itself, so this needs no state of its own.
   *
   * Use it to hold back anything that would be a lie about a value not yet
   * read - a live region, a warning, a count.
   */
  isHydrated: (value: T | P) => value is T;
}

export function createLocalStore<T, P = T>(options: {
  /** The storage key, so a `storage` event from another tab can be told apart. */
  key: string;
  read: () => T;
  write: (value: T) => boolean;
  /**
   * What the server renders, and what the client renders while hydrating, so
   * the two agree.
   *
   * Its IDENTITY is the hydration flag, so it must be one fixed value created
   * once. React calls getServerSnapshot more than once during hydration and
   * compares the results by identity: hand back a fresh clone per call and it
   * warns that the store mutated during render, then re-renders for ever.
   *
   * Where the screen has nothing useful to draw before storage is read, pass
   * `undefined`; where it needs a shape to render controls from, pass a clone
   * of the defaults, never the exported defaults themselves - a screen could
   * mutate what it is handed and poison them for everyone.
   */
  placeholder: P;
}): LocalStore<T, P> {
  const { key, read, write, placeholder } = options;

  const listeners = new Set<() => void>();
  // `!`: assigned by `current()`/`subscribe` before any read, which the `loaded`
  // flag guarantees and the compiler cannot see.
  let snapshot!: T;
  // A separate flag rather than `snapshot ?? read()`: `null` and `undefined`
  // are legitimate stored values here (no workout in progress), and a nullish
  // check would re-read storage on every call and hand back a new object each
  // time, which is the one thing useSyncExternalStore cannot tolerate.
  let loaded = false;

  const notify = (): void => {
    // Copied, so a listener that unsubscribes while being notified cannot skip
    // the next one.
    for (const listener of [...listeners]) listener();
  };

  const current = (): T => {
    if (!loaded) {
      snapshot = read();
      loaded = true;
    }
    return snapshot;
  };

  /**
   * Another tab, or anything else writing the same key, changes the value under
   * a mounted screen. Without this the screen shows a value the user has already
   * replaced until it happens to remount.
   *
   * `key === null` is the whole-storage clear, which counts. The value is
   * re-read through `read` rather than taken from `event.newValue`, so the
   * repairs in storage.ts apply to it exactly as they do to a normal read.
   */
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== null && event.key !== key) return;
    snapshot = read();
    loaded = true;
    notify();
  };

  const subscribe = (onStoreChange: () => void): (() => void) => {
    if (listeners.size === 0) {
      // The commit is the first moment localStorage may be read. React re-checks
      // the snapshot immediately after `subscribe` returns - it queues
      // `subscribeToStore` before `updateStoreInstance` - so refreshing here is
      // enough to pull the stored value in with no setState and no notification
      // mid-subscribe.
      snapshot = read();
      loaded = true;
      if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    }
    listeners.add(onStoreChange);

    return () => {
      listeners.delete(onStoreChange);
      if (listeners.size === 0 && typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
      }
    };
  };

  const publish = (next: T | ((previous: T) => T)): boolean => {
    // With nothing mounted, the cache is answering to nobody and may be
    // arbitrarily old: the `storage` event that keeps it honest only fires for
    // writes from ANOTHER tab, so anything that changed this key from outside
    // the store in this one is invisible until something subscribes.
    //
    // That is not hypothetical. The runner appends a finished session without
    // ever reading history itself, so at that moment this store has no
    // listeners at all. Re-reading first makes such a write a genuine
    // read-modify-write - the same guarantee `pushHistory` gave when it read
    // storage on every call - rather than an update applied to a stale copy.
    //
    // While listeners exist the cache is already current (this tab is the only
    // writer, and another tab's write arrives as a `storage` event), so the
    // re-read costs nothing where it would not help.
    if (listeners.size === 0) {
      snapshot = read();
      loaded = true;
    }
    const value = typeof next === 'function' ? (next as (previous: T) => T)(current()) : next;
    snapshot = value;
    loaded = true;
    const written = write(value);
    notify();
    return written;
  };

  const isHydrated = (value: T | P): value is T => value !== placeholder;

  const getSnapshot = (): T | P => current();
  const getServerSnapshot = (): T | P => placeholder;

  return { subscribe, getSnapshot, getServerSnapshot, publish, isHydrated };
}
