'use client';

import { useSyncExternalStore } from 'react';
import { HISTORY_KEY, loadHistory, saveHistory } from '@/lib/storage';
import { createLocalStore } from '@/lib/local-store';
import type { HistoryEntry } from '@/lib/types';

/* ---------------------------------------------------------------------------
   What he has already done, as one shared store.

   Three screens read it now - Home counts the week off it, Done shows the
   session that has just ended, History lists the lot - and one of them writes
   to it. That is exactly the situation `local-store.ts` exists for: a private
   cache per screen is three screens quietly disagreeing about whether the
   workout he just finished happened.

   It matters more here than anywhere else, because history is the one stored
   value written mid-session. The runner appends an entry and pushes straight to
   Done with no reload in between, so a screen holding its own stale copy would
   show the session before last on the screen whose whole job is the session he
   just did. Hence `appendHistory` rather than `pushHistory` at that call site:
   the write and the notification are the same act.

   The placeholder is `undefined`, not `[]`. An empty array is a real, hydrated
   answer - "you have never trained" - and Home says exactly that out loud, so
   it cannot also be the way the app says "storage has not been read yet".
--------------------------------------------------------------------------- */
const store = createLocalStore<HistoryEntry[], undefined>({
  key: HISTORY_KEY,
  read: loadHistory,
  write: saveHistory,
  placeholder: undefined,
});

export const subscribeHistory = store.subscribe;
export const getHistorySnapshot = store.getSnapshot;
export const getHistoryServerSnapshot = store.getServerSnapshot;
export const publishHistory = store.publish;

/** False only during the server render and the hydration render. */
export const isHistoryHydrated = store.isHydrated;

/** Newest first, which is the order every screen reads it in. */
export const appendHistory = (e: HistoryEntry): boolean =>
  publishHistory((previous) => [e, ...previous]);

/**
 * Stamps how a finished session felt onto the entry it belongs to.
 *
 * Matched by id rather than "the first one", so a rating cannot land on the
 * wrong workout if another entry arrives while the Done screen is open.
 */
export const rateEntry = (id: string, felt: HistoryEntry['felt']): boolean =>
  publishHistory((previous) => previous.map((e) => (e.id === id ? { ...e, felt } : e)));

export const useHistory = (): HistoryEntry[] | undefined =>
  useSyncExternalStore(subscribeHistory, getHistorySnapshot, getHistoryServerSnapshot);
