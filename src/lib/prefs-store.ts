'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_PREFS, PREFS_KEY, loadPrefs, savePrefs, type Prefs } from '@/lib/storage';
import { createLocalStore } from '@/lib/local-store';

/**
 * The setup choices - which patterns, how hard, how long - as one shared store,
 * for the same reason the kit is one: whoever reads them next has to see what
 * was last written, and a screen cannot read localStorage during render without
 * splitting the server and client renders apart.
 *
 * The Setup screen holds its in-progress edits in local state and publishes
 * once, when the workout is generated, so what is stored here is always "what
 * he last actually trained with" rather than every chip he tapped on the way.
 */
const HYDRATION_SNAPSHOT: Prefs = structuredClone(DEFAULT_PREFS);

const store = createLocalStore<Prefs>({
  key: PREFS_KEY,
  read: loadPrefs,
  write: savePrefs,
  placeholder: HYDRATION_SNAPSHOT,
});

export const subscribePrefs = store.subscribe;
export const getPrefsSnapshot = store.getSnapshot;
export const getPrefsServerSnapshot = store.getServerSnapshot;

/**
 * Writes the choices through to storage and tells every mounted screen.
 *
 * Returns whether the write landed. Prefs are the one stored value where a
 * failed write is genuinely not worth interrupting anyone over: the cost is
 * that next session opens on the defaults, and stopping a man who is standing
 * over a kettlebell to tell him his browser storage is full would be worse.
 */
export const publishPrefs = store.publish;

export const isPrefsHydrated = (prefs: Prefs): boolean => store.isHydrated(prefs);

export const usePrefs = (): Prefs =>
  useSyncExternalStore(subscribePrefs, getPrefsSnapshot, getPrefsServerSnapshot);
