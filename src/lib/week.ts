import type { HistoryEntry } from '@/lib/types';

/**
 * The last seven days, counted in LOCAL days rather than in milliseconds.
 *
 * A rolling `now - 7 * 864e5` window and a row of seven day-dots disagree by up
 * to a day: a session at eight last Tuesday morning falls inside one and
 * outside the other, so the count would say two and the dots would show three.
 * One definition of "this week", used by both, is worth the small module.
 *
 * Local days, not UTC ones, because he trains in his own evening. A nine-o'clock
 * session in London in December is already tomorrow in UTC, and a dot lighting
 * up for the day after he trained is simply wrong.
 *
 * `now` is passed in. Nothing in `src/lib` reads the clock except `clock.ts`.
 */
export const DAYS = 7;

/** A local calendar day as a sortable, comparable key. */
export function dayKey(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

/** The seven local days ending today, oldest first, so the row reads left to right. */
export function weekDays(now: number): Date[] {
  const today = new Date(now);
  return Array.from({ length: DAYS }, (_, i) => {
    const at = new Date(today);
    // setDate handles month ends, leap days and the clocks going back for us.
    at.setDate(today.getDate() - (DAYS - 1 - i));
    at.setHours(0, 0, 0, 0);
    return at;
  });
}

/**
 * The entries that fall on one of those seven days.
 *
 * An unparseable `createdAt` is dropped rather than counted: an entry that
 * cannot be placed on a day must not silently be placed on today's.
 */
export function entriesThisWeek(history: HistoryEntry[], now: number): HistoryEntry[] {
  const week = new Set(weekDays(now).map(dayKey));
  return history.filter((e) => {
    const at = new Date(e.createdAt);
    return !Number.isNaN(at.getTime()) && week.has(dayKey(at));
  });
}

/** One flag per day, oldest first: did he train that day. */
export function trainedOnEachDay(history: HistoryEntry[], now: number): boolean[] {
  const trained = new Set(
    history
      .map((e) => new Date(e.createdAt))
      .filter((at) => !Number.isNaN(at.getTime()))
      .map(dayKey),
  );
  return weekDays(now).map((day) => trained.has(dayKey(day)));
}

/** Whole minutes, rounded once at the end rather than per entry. */
export const minutesOf = (entries: HistoryEntry[]): number =>
  Math.round(entries.reduce((total, e) => total + e.workedSeconds, 0) / 60);
