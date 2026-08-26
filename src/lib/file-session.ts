'use client';

import { tick } from '@/lib/clock';
import { publishActive } from '@/lib/active-store';
import { appendHistory } from '@/lib/history-store';
import { partialEntry, wasStarted } from '@/lib/record';
import type { ActiveState } from '@/lib/storage';
import type { HistoryEntry } from '@/lib/types';

/**
 * The one way a live session stops being live without being finished.
 *
 * Both routes out lead here. Generating a new workout over the top of one in
 * progress used to overwrite the active slot outright - no warning, no record,
 * the work simply gone - and the button that did it sits directly under the
 * quiet grey Resume. A session left more than three hours had the same ending
 * more slowly: Home rightly stops offering to resume it, and nothing ever
 * converted it to history, so it aged out of existence.
 *
 * So the question in both cases is the same - there is a session that will not
 * be resumed, what happens to it - and the answer here is never "it disappears".
 * It is filed as it stands, exactly as "End here" files a workout he stops
 * halfway, and only then is the slot released.
 *
 * Returns the entry written, or null when there was nothing worth writing.
 */
export function fileSession(state: ActiveState | null): HistoryEntry | null {
  if (state === null) return null;

  if (!wasStarted(state)) {
    // Built and never begun. Releasing the slot is not a deletion: there is no
    // session here to lose, and filing one would put a row in History for
    // something that did not happen.
    publishActive(null);
    return null;
  }

  const entry = partialEntry(state, tick());
  appendHistory(entry);
  publishActive(null);
  return entry;
}
