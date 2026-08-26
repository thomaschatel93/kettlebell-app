'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_KIT_STATE, type KitState } from '@/lib/kit';
import { KITS_KEY, loadKits, saveKits } from '@/lib/storage';

/* ---------------------------------------------------------------------------
   The kit as one shared external store.

   Every screen that reads the kit reads it through here. The alternative -
   each screen caching its own copy behind its own useSyncExternalStore - is
   four screens quietly disagreeing about which bells the user owns, because a
   write on one is invisible to the others until they remount.

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
--------------------------------------------------------------------------- */

const listeners = new Set<() => void>();
let snapshot: KitState | null = null;

/**
 * What the server renders, and what the client renders while hydrating, so the
 * two agree.
 *
 * Cloned ONCE, at module scope. `getServerSnapshot` is called more than once
 * during hydration and React compares the results by identity: return a fresh
 * `structuredClone(DEFAULT_KIT_STATE)` per call and it warns about the store
 * mutating during render and re-renders forever. It is also never handed out
 * for mutation, so it cannot poison the exported default.
 */
const HYDRATION_SNAPSHOT: KitState = structuredClone(DEFAULT_KIT_STATE);

const notify = (): void => {
  // Copied, so a listener that unsubscribes while being notified cannot skip
  // the next one.
  for (const listener of [...listeners]) listener();
};

const reread = (): void => {
  snapshot = loadKits();
  notify();
};

/**
 * Another tab, or anything else writing the same key, changes the kit under a
 * mounted screen. Without this the screen shows a kit the user no longer owns
 * until it happens to remount.
 *
 * `key === null` is the whole-storage clear, which counts. The value is re-read
 * through `loadKits` rather than taken from `event.newValue`, so the repairs in
 * storage.ts apply to it exactly as they do to a normal read.
 */
const onStorage = (event: StorageEvent): void => {
  if (event.key !== null && event.key !== KITS_KEY) return;
  reread();
};

export function subscribeKit(onStoreChange: () => void): () => void {
  if (listeners.size === 0) {
    // The commit is the first moment localStorage may be read. React re-checks
    // the snapshot immediately after `subscribe` returns - it queues
    // `subscribeToStore` before `updateStoreInstance` - so refreshing here is
    // enough to pull the stored kit in with no setState and no notification
    // mid-subscribe.
    snapshot = loadKits();
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  }
  listeners.add(onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

/** Cached: useSyncExternalStore needs a stable reference between calls. */
export const getKitSnapshot = (): KitState => (snapshot ??= loadKits());

/** Stable by identity. See HYDRATION_SNAPSHOT. */
export const getKitServerSnapshot = (): KitState => HYDRATION_SNAPSHOT;

/**
 * The only way to change the kit. Writes through to storage first, so nothing
 * ever lives only in React state, then tells every mounted screen.
 */
export function publishKit(next: KitState): void {
  snapshot = next;
  saveKits(next);
  notify();
}

/**
 * True once the real stored kit is in hand, rather than the placeholder the
 * hydration render is given. Only that render is ever handed HYDRATION_SNAPSHOT
 * itself, so this needs no state of its own.
 *
 * Use it to hold back anything that would be a lie about a kit not yet read -
 * a live region, a warning, a count.
 */
export const isKitHydrated = (state: KitState): boolean => state !== HYDRATION_SNAPSHOT;

/** The whole API a screen needs: `const kit = useKit();` */
export const useKit = (): KitState =>
  useSyncExternalStore(subscribeKit, getKitSnapshot, getKitServerSnapshot);
