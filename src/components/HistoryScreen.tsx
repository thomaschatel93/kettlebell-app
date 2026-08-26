'use client';

import Link from 'next/link';
import { buttonClass } from '@/components/Button';
import { Card } from '@/components/Card';
import { PatternTag } from '@/components/Chip';
import { isHistoryHydrated, useHistory } from '@/lib/history-store';
import { FELT_LABEL, dayText, exerciseNames, formatLabel, minutesText, patternsOf } from '@/lib/session';
import type { HistoryEntry, WorkStep } from '@/lib/types';

/** One round is the shape of the session; repeating it three times is noise. */
const firstRound = (entry: HistoryEntry): WorkStep[] =>
  (entry.workout?.steps ?? []).filter((s): s is WorkStep => s.kind === 'work' && s.round === 1);

const prescription = (s: WorkStep): string =>
  s.reps !== undefined ? `${s.reps} reps` : s.seconds !== undefined ? `${s.seconds} sec` : '';

/**
 * Newest first, defensively. Storage already writes in that order, but a row
 * out of order here is a session he cannot find, and sorting a list of thirty
 * costs nothing.
 */
const newestFirst = (history: HistoryEntry[]): HistoryEntry[] =>
  [...history].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

function Row({ entry }: { entry: HistoryEntry }) {
  const patterns = patternsOf(entry);
  const steps = firstRound(entry);
  const moves = exerciseNames(entry);

  return (
    <Card className="p-0">
      {/*
        A native disclosure, not a button and a piece of state. It is open and
        closed correctly for a screen reader for free, it survives with
        JavaScript still loading, and it needs no animation to explain itself -
        which is the honest answer under prefers-reduced-motion anyway.
      */}
      <details className="group">
        <summary
          className="tap-target flex cursor-pointer list-none flex-col gap-2 p-5
            [&::-webkit-details-marker]:hidden"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-bold tracking-tight">{dayText(entry.createdAt)}</span>
            <span className="text-sm text-[var(--text-dim)]">
              {`${formatLabel(entry)} · ${minutesText(entry.workedSeconds)}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {entry.felt && (
              <span
                className="inline-flex items-center rounded-full border border-[var(--border)]
                  bg-[var(--surface-2)] px-2.5 py-1 text-xs font-bold text-[var(--text)]"
              >
                {FELT_LABEL[entry.felt]}
              </span>
            )}
            {patterns.map((p) => (
              <PatternTag key={p} tone={p}>{p[0].toUpperCase() + p.slice(1)}</PatternTag>
            ))}
          </div>
        </summary>

        <div className="border-t border-[var(--border)] p-5">
          {steps.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {steps.map((s, i) => (
                <li
                  key={`${s.exerciseId}-${s.side ?? 'both'}-${i}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="text-base font-bold leading-tight">
                    {s.side ? `${s.name} (${s.side})` : s.name}
                  </span>
                  <span className="shrink-0 text-sm text-[var(--text-dim)]">
                    {[prescription(s), s.bellKg === null ? 'bodyweight' : `${s.bellKg} kg`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : moves.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {moves.map((name) => (
                <li key={name} className="text-base font-bold leading-tight">{name}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-dim)]">No moves were recorded for this session.</p>
          )}
        </div>
      </details>
    </Card>
  );
}

/**
 * Everything he has done, newest first, each row opening into what was in it.
 *
 * Thirty sessions is the whole store, so there is no paging and no search: a
 * list this long is read by scrolling, and anything cleverer would be building
 * for a scale this app has decided not to have.
 */
export function HistoryScreen() {
  const history = useHistory();

  if (!isHistoryHydrated(history)) {
    return <p className="text-sm text-[var(--text-dim)]">Reading your history…</p>;
  }

  if (history.length === 0) {
    return (
      <>
        <Card className="flex flex-col gap-2">
          <p className="text-base font-bold">No workouts yet.</p>
          <p className="text-sm text-[var(--text-dim)]">
            Finish one and it lands here, with what you did and how it felt.
          </p>
        </Card>
        <Link href="/workout" className={buttonClass()}>Start a workout</Link>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {newestFirst(history).map((entry) => (
        <Row key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
