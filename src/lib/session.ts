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

/**
 * Whole minutes for one session. Under a minute is still 1 - he did do
 * something - and the floor lives here rather than at each call site so the
 * total on Home is the sum of the numbers the History rows actually show. Two
 * different roundings of the same seconds is a bug to anyone reading the two
 * screens together, whatever either one is doing on its own.
 */
export const sessionMinutes = (seconds: number): number =>
  seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0;

export const minutesText = (seconds: number): string => `${sessionMinutes(seconds)} min`;

/**
 * How many times round. Written once and used by both Preview and History,
 * because a session described as "5 rounds" before it starts and as eight moves
 * afterwards is the same workout reported at a fifth of its real volume.
 */
export const roundsText = (rounds: number): string =>
  rounds > 1 ? `${rounds} rounds` : 'once through';

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
