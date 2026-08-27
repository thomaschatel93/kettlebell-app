'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_KIT_STATE, type KitState } from '@/lib/kit';
import { KITS_KEY, loadKits, saveKits } from '@/lib/storage';
import { createLocalStore } from '@/lib/local-store';

/* ---------------------------------------------------------------------------
   The kit as one shared external store.

   Every screen that reads the kit reads it through here. The alternative -
   each screen caching its own copy behind its own useSyncExternalStore - is
   four screens quietly disagreeing about which bells the user owns, because a
   write on one is invisible to the others until they remount.

   The subscribe/notify/hydrate machinery moved to `local-store.ts` when the
   Setup and Preview screens needed the same thing for the prefs and for the
   workout in progress. Three copies of it was the fork worth avoiding; the
   reasoning behind each part of it is written up there.
--------------------------------------------------------------------------- */

/**
 * What the server renders, and what the client renders while hydrating, so the
 * two agree.
 *
 * Cloned ONCE, at module scope, because its identity is the hydration flag, and
 * because it is never the exported default itself - a screen handed it for
 * mutation could otherwise poison the default for everyone.
 */
const HYDRATION_SNAPSHOT: KitState = structuredClone(DEFAULT_KIT_STATE);

const store = createLocalStore<KitState>({
  key: KITS_KEY,
  read: loadKits,
  write: saveKits,
  placeholder: HYDRATION_SNAPSHOT,
});

export const subscribeKit = store.subscribe;

/** Cached: useSyncExternalStore needs a stable reference between calls. */
export const getKitSnapshot = store.getSnapshot;

/** Stable by identity. See HYDRATION_SNAPSHOT. */
export const getKitServerSnapshot = store.getServerSnapshot;

/**
 * The only way to change the kit. Writes through to storage first, so nothing
 * ever lives only in React state, then tells every mounted screen.
 *
 * Takes an updater as well as a whole state, and returns whether the write
 * actually reached storage. Both matter: two whole-state writes inside one
 * JavaScript task clobber each other, and a write can fail on quota or in
 * private mode, leaving the snapshot ahead of what a reload would find.
 */
export const publishKit = store.publish;

/**
 * True once the real stored kit is in hand, rather than the placeholder the
 * hydration render is given.
 *
 * Use it to hold back anything that would be a lie about a kit not yet read -
 * a live region, a warning, a count.
 */
export const isKitHydrated = (state: KitState): boolean => store.isHydrated(state);

/** The whole API a screen needs: `const kit = useKit();` */
export const useKit = (): KitState =>
  useSyncExternalStore(subscribeKit, getKitSnapshot, getKitServerSnapshot);
