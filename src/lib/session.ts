import { ALL_EXERCISES } from '@/lib/data/ancillary';
import type { Format, HistoryEntry, Pattern } from '@/lib/types';

/**
 * How a finished session is described, in the three places one is shown: the
 * card on Home, the Done screen, and every row of History. Written once here
 * because "34 min" and "Circuit" appearing in three different shapes across
 * three screens is how an app starts to look like three apps.
 *
 * Pure, and it reads no clock: given an entry it always says the same thing.
 */
const BY_ID = new Map(ALL_EXERCISES.map((e) => [e.id, e]));

export const FORMAT_LABEL: Record<Format, string> = {
  circuit: 'Circuit',
  complex: 'Complex',
  strength: 'Strength',
};

/** The format actually built. Unreadable stored values are not dressed up. */
export const formatLabel = (entry: HistoryEntry): string =>
  FORMAT_LABEL[entry.workout?.format as Format] ?? 'Workout';

/** Whole minutes. Under a minute is still "1 min" - he did do something. */
export const minutesText = (seconds: number): string =>
  `${seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0} min`;

/** The distinct main-block moves, in the order he did them. */
export const exerciseNames = (entry: HistoryEntry): string[] =>
  entry.mainExerciseIds.map((id) => BY_ID.get(id)?.name ?? id);

/**
 * The patterns a session actually trained, taken from the moves performed
 * rather than from the request: what he asked for and what the kit could give
 * him are not always the same thing, and the record should show the second.
 */
export function patternsOf(entry: HistoryEntry): Pattern[] {
  const seen: Pattern[] = [];
  for (const id of entry.mainExerciseIds) {
    const primary = BY_ID.get(id)?.patterns[0];
    if (primary && !seen.includes(primary)) seen.push(primary);
  }
  return seen;
}

export const FELT_LABEL: Record<NonNullable<HistoryEntry['felt']>, string> = {
  easy: 'Easy',
  right: 'Right',
  brutal: 'Brutal',
};

/** "Tue 25 Aug". An unreadable stored date says so rather than showing NaN. */
export function dayText(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'Undated';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(at);
}
