'use client';

import { useSyncExternalStore } from 'react';
import { HISTORY_KEY, MAX_HISTORY, loadHistory, saveHistory } from '@/lib/storage';
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

/**
 * Newest first, which is the order every screen reads it in.
 *
 * Capped here as well as in `saveHistory`: the write drops the thirty-first
 * entry, and without the same cut the snapshot every mounted screen is reading
 * keeps it, so Home counts one more session than a reload would find.
 */
export const appendHistory = (e: HistoryEntry): boolean =>
  publishHistory((previous) => [e, ...previous].slice(0, MAX_HISTORY));

/**
 * Stamps how a finished session felt onto the entry it belongs to.
 *
 * Matched by id rather than "the first one", so a rating cannot land on the
 * wrong workout if another entry arrives while the Done screen is open.
 */
export const rateEntry = (id: string, felt: HistoryEntry['felt']): boolean =>
  publishHistory((previous) => previous.map((e) => (e.id === id ? { ...e, felt } : e)));

/**
 * Throws sessions away, permanently.
 *
 * The runner may not delete a session that happened - that rule is what makes
 * "End here" safe to tap mid-workout - but this is the other side of it: it is
 * his record, and a record he cannot prune is a record he stops trusting. The
 * deliberation lives in the screen, which asks twice before it calls this; by
 * the time it is called the decision has been made and there is nothing left
 * here to soften.
 *
 * Takes a set rather than one id, so removing four rows is one write and one
 * notification instead of four of each.
 */
export const removeEntries = (ids: ReadonlySet<string>): boolean =>
  publishHistory((previous) => previous.filter((e) => !ids.has(e.id)));

export const useHistory = (): HistoryEntry[] | undefined =>
  useSyncExternalStore(subscribeHistory, getHistorySnapshot, getHistoryServerSnapshot);
