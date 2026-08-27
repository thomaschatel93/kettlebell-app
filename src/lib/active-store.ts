'use client';

import { useSyncExternalStore } from 'react';
import { ACTIVE_KEY, clearActive, loadActive, saveActive, type ActiveState } from '@/lib/storage';
import { createLocalStore } from '@/lib/local-store';

/**
 * The workout in progress - the one the Preview screen shows and the run screen
 * walks through - as one shared store.
 *
 * `null` is a real, hydrated value here: it means there is no workout waiting.
 * So the placeholder cannot be `null`, or "nothing stored" and "storage not
 * read yet" would be the same state and the Preview screen would flash "no
 * workout" before every workout. `undefined` is the placeholder instead, and it
 * is stable by identity for free.
 */
const store = createLocalStore<ActiveState | null, undefined>({
  key: ACTIVE_KEY,
  read: loadActive,
  // Publishing `null` is how a screen says the workout is over. Removing the
  // key rather than storing a null keeps `loadActive`'s shape check the single
  // definition of what a valid stored workout looks like.
  write: (value) => {
    if (value === null) {
      clearActive();
      return true;
    }
    return saveActive(value);
  },
  placeholder: undefined,
});

export const subscribeActive = store.subscribe;
export const getActiveSnapshot = store.getSnapshot;
export const getActiveServerSnapshot = store.getServerSnapshot;

/**
 * Writes the workout through to storage and tells every mounted screen.
 *
 * Look at what this returns. The next screen reads the workout back OUT of
 * storage, so a write that silently failed on quota or in private mode lands
 * the user on an empty Preview with no idea why. That is the one case in this
 * app where a failed write has to be said out loud rather than absorbed.
 */
export const publishActive = store.publish;

/** False only during the server render and the hydration render. */
export const isActiveHydrated = store.isHydrated;

export const useActiveWorkout = (): ActiveState | null | undefined =>
  useSyncExternalStore(subscribeActive, getActiveSnapshot, getActiveServerSnapshot);
