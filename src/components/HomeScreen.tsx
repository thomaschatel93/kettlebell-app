'use client';

import { useState } from 'react';
import Link from 'next/link';
import { buttonClass } from '@/components/Button';
import { Card } from '@/components/Card';
import { PatternTag } from '@/components/Chip';
import { Ring } from '@/components/Ring';
import { isActiveHydrated, useActiveWorkout } from '@/lib/active-store';
import { nowMs } from '@/lib/clock';
import { isHistoryHydrated, useHistory } from '@/lib/history-store';
import { useKit } from '@/lib/kit-store';
import { FELT_LABEL, dayText, formatLabel, minutesText, patternsOf } from '@/lib/session';
import { dayKey, entriesThisWeek, minutesOf, trainedOnEachDay, weekDays } from '@/lib/week';
import type { HistoryEntry } from '@/lib/types';

/* ---------------------------------------------------------------------------
   Why there is no streak on this screen

   A consecutive-days counter is the obvious thing to put here and it is the
   wrong thing. Nobody swings kettlebells seven days a week - the whole point of
   ballistic work is that it needs recovery - so a streak reads 0 or 1 almost
   every time he opens the app. That is a training app telling a man who trains
   four times a week that he has done nothing, and the first thing it does is
   make him want to train on a day he should not.

   What is here instead: two counts of the last seven days, and seven dots. The
   dots say the same thing a streak was reaching for - the shape of the week -
   without punishing the rest days that make the week work. A gap is not a
   failure, it is Wednesday.
--------------------------------------------------------------------------- */

/**
 * What the rings are drawn against. Neither is a goal he set or a promise the
 * app makes; a ring simply needs a full turn to mean anything, and four
 * sessions of half an hour is what a week of this training actually looks like.
 *
 * Never below the real number - `Math.max` below - so a big week fills the ring
 * rather than being clipped to fit the reference.
 */
const WEEK_SESSIONS = 4;
const WEEK_MINUTES = 120;

/**
 * How long a workout in progress is still worth offering to resume.
 *
 * Without an expiry, a session abandoned last Tuesday sits on this screen for a
 * week and eventually gets tapped - dropping him into the middle of a workout
 * built for a body that has since done three others, with a rest timer counting
 * from a deadline days in the past. Three hours is long enough to cover a
 * genuine interruption and short enough that nothing stale survives to tomorrow.
 */
const RESUME_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * An unreadable `createdAt` is NOT evidence the workout is stale, so it stays
 * resumable: throwing away a session in progress on the strength of a date we
 * failed to parse is the worse of the two mistakes, and the run screen
 * re-validates the whole state before it renders anything anyway.
 */
function isResumable(createdAt: string, now: number): boolean {
  const age = now - new Date(createdAt).getTime();
  return !(Number.isFinite(age) && age > RESUME_WINDOW_MS);
}

/** "M", "T", … under each dot, so the row is a week and not seven blobs. */
const initial = (day: Date): string =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'narrow' }).format(day);

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The week as seven dots. One statement to assistive technology - the dots
 * themselves say nothing individually, and seven separately announced blobs
 * would be worse than useless.
 */
function WeekDots({ days, trained }: { days: Date[]; trained: boolean[] }) {
  const count = trained.filter(Boolean).length;
  return (
    <div
      role="img"
      aria-label={`Trained on ${plural(count, 'day')} of the last 7`}
      className="flex items-end justify-between gap-1"
    >
      {days.map((day, i) => (
        <div key={dayKey(day)} className="flex flex-col items-center gap-1.5">
          <span
            data-testid="week-dot"
            data-trained={trained[i]}
            className={`block h-3.5 w-3.5 rounded-full border ${
              trained[i]
                ? 'border-[var(--accent)] bg-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--surface-2)]'
            }`}
          />
          <span className="text-xs font-medium text-[var(--text-dim)]">{initial(day)}</span>
        </div>
      ))}
    </div>
  );
}

/** The last session, in the shape History uses, so the two agree on the facts. */
function LastSession({ entry }: { entry: HistoryEntry }) {
  const patterns = patternsOf(entry);
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Last session</h2>
        <span className="text-sm text-[var(--text-dim)]">{dayText(entry.createdAt)}</span>
      </div>
      <p className="text-base font-bold">
        {`${formatLabel(entry)} · ${minutesText(entry.workedSeconds)}`}
        {entry.felt ? ` · ${FELT_LABEL[entry.felt]}` : ''}
      </p>
      {patterns.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {patterns.map((p) => (
            <PatternTag key={p} tone={p}>{p[0].toUpperCase() + p.slice(1)}</PatternTag>
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * The screen he opens the app on: what the week looks like, whether there is
 * something to pick back up, and one way in.
 *
 * Every stored value it reads comes through a shared store rather than an
 * effect - see `local-store.ts` for why hydrating from localStorage in an
 * effect is both a hydration mismatch and a lint error in Next 16.
 */
export function HomeScreen() {
  const history = useHistory();
  const active = useActiveWorkout();
  const kit = useKit();
  // Lazily, once, at mount: `Date.now()` in a component body is rejected
  // outright by react-hooks/purity, and a clock re-read every render would
  // shuffle the dots under him mid-frame.
  const [now] = useState(nowMs);

  const profile = kit.profiles.find((p) => p.id === kit.activeId) ?? kit.profiles[0];

  const resume =
    isActiveHydrated(active) && active !== null && isResumable(active.workout.createdAt, now)
      ? active
      : null;

  const header = (
    <header className="flex items-baseline justify-between gap-3">
      <h1 className="text-3xl font-bold tracking-tight">Kettlebell</h1>
      <Link
        href="/kit"
        className="tap-target inline-flex items-center rounded-full border border-[var(--border)]
          bg-[var(--surface-2)] px-4 text-sm font-bold text-[var(--text)]"
      >
        <span>{profile.name}</span>
      </Link>
    </header>
  );

  if (!isHistoryHydrated(history)) {
    return (
      <>
        {header}
        <p className="text-sm text-[var(--text-dim)]">Reading your history…</p>
        <Link href="/workout" className={buttonClass()}>Start a workout</Link>
      </>
    );
  }

  const week = entriesThisWeek(history, now);
  const days = weekDays(now);
  const trained = trainedOnEachDay(history, now);
  const weekMinutes = minutesOf(week);

  return (
    <>
      {header}

      <Card className="flex flex-col gap-5">
        <div className="flex items-center justify-center gap-4">
          <Ring
            value={week.length}
            max={Math.max(week.length, WEEK_SESSIONS)}
            label="Workouts this week"
            caption="workouts"
          />
          <Ring
            value={weekMinutes}
            max={Math.max(weekMinutes, WEEK_MINUTES)}
            label="Minutes"
            caption="minutes"
          />
        </div>

        <WeekDots days={days} trained={trained} />

        <p className="text-sm text-[var(--text-dim)]">
          {`All time: ${plural(history.length, 'workout')}, ${minutesOf(history)} min.`}
        </p>
      </Card>

      {resume && (
        <Link href="/workout/run" className={buttonClass('ghost')}>
          Resume workout
        </Link>
      )}

      <Link href="/workout" className={buttonClass()}>Start a workout</Link>

      {history.length === 0 ? (
        <Card className="flex flex-col gap-2">
          <p className="text-base font-bold">No workouts yet.</p>
          <p className="text-sm text-[var(--text-dim)]">
            Tell it what you are training and how long you have, and it builds one round the bells you own.
          </p>
        </Card>
      ) : (
        <LastSession entry={history[0]} />
      )}
    </>
  );
}
