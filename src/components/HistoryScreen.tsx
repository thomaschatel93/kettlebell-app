'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonClass } from '@/components/Button';
import { Card } from '@/components/Card';
import { PatternTag } from '@/components/Chip';
import { isHistoryHydrated, removeEntries, useHistory } from '@/lib/history-store';
import { FELT_LABEL, dayText, exerciseNames, formatLabel, minutesText, patternsOf, roundsText } from '@/lib/session';
import type { HistoryEntry, WorkStep } from '@/lib/types';

/**
 * The moves of the session, once.
 *
 * Three filters, each earning its place. One round, because repeating the same
 * five moves three times is noise rather than record. The Main block, because
 * an expanded row that opens on four minutes of arm circles and a couch stretch
 * buries the twelve lines that are the actual workout. And only the moves he
 * got through - `mainExerciseIds` is what the runner recorded as performed - so
 * a session ended early shows what happened rather than what was planned.
 *
 * That last filter is also what makes this screen agree with Done: both are
 * then reading the same list of performed moves, so the two cannot describe one
 * session two different ways. An entry with no recorded moves (an older or
 * repaired record) falls back to the planned main block, which is the best
 * account of it that survives.
 */
const mainFirstRound = (entry: HistoryEntry): WorkStep[] =>
  (entry.workout?.steps ?? []).filter(
    (s): s is WorkStep => s.kind === 'work' && s.block === 'Main' && s.round === 1,
  );

const firstRound = (entry: HistoryEntry): WorkStep[] => {
  const main = mainFirstRound(entry);
  if (entry.mainExerciseIds.length === 0) return main;
  return main.filter((s) => entry.mainExerciseIds.includes(s.exerciseId));
};

/**
 * How many times he went round that list. Without it the row reads as one pass
 * of eight moves - a thirty-minute session reported at a fifth of its volume,
 * while Preview describes the same workout as five rounds.
 */
const mainRounds = (entry: HistoryEntry): number => mainFirstRound(entry)[0]?.totalRounds ?? 1;

const prescription = (s: WorkStep): string =>
  s.reps !== undefined ? `${s.reps} reps` : s.seconds !== undefined ? `${s.seconds} sec` : '';

/**
 * Newest first, defensively. Storage already writes in that order, but a row
 * out of order here is a session he cannot find, and sorting a list of thirty
 * costs nothing.
 */
const newestFirst = (history: HistoryEntry[]): HistoryEntry[] =>
  [...history].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

function Row({
  entry,
  selecting,
  selected,
  onToggle,
}: {
  entry: HistoryEntry;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const patterns = patternsOf(entry);
  const steps = firstRound(entry);
  const moves = exerciseNames(entry);
  const rounds = mainRounds(entry);

  return (
    <Card className="flex items-start gap-0 p-0">
      {/*
        The tick sits OUTSIDE the disclosure, not inside its summary. A control
        inside a <summary> is a control that also opens the row, and a tick that
        expands a session while marking it for deletion is exactly the wrong
        feedback for the one action in this app that cannot be undone.
      */}
      {selecting && (
        <label className="tap-target flex shrink-0 cursor-pointer items-center justify-center self-stretch pl-4">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select the workout from ${dayText(entry.createdAt)}`}
            className="h-7 w-7 accent-[var(--accent)]"
          />
        </label>
      )}
      {/*
        A native disclosure, not a button and a piece of state. It is open and
        closed correctly for a screen reader for free, it survives with
        JavaScript still loading, and it needs no animation to explain itself -
        which is the honest answer under prefers-reduced-motion anyway.
      */}
      <details className="group min-w-0 flex-1">
        <summary
          className="tap-target flex cursor-pointer list-none flex-col gap-2 p-5
            [&::-webkit-details-marker]:hidden"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-bold tracking-tight">{dayText(entry.createdAt)}</span>
            <span className="flex items-baseline gap-2 text-sm text-[var(--text-dim)]">
              {`${formatLabel(entry)} · ${minutesText(entry.workedSeconds)}`}
              {/*
                The one thing that says a row opens. The native marker is hidden
                because it cannot be styled to the design system, so hiding it
                without replacing it left the row looking like a flat card. The
                turn is CSS on the parent's open state - no JavaScript, no second
                source of truth about whether the row is open - and the global
                prefers-reduced-motion rule cuts the transition to nothing.
              */}
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 translate-y-0.5 transition-transform duration-200 group-open:-rotate-180"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
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

        <div className="flex flex-col gap-3 border-t border-[var(--border)] p-5">
          {steps.length > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-bold tracking-tight">Main</h3>
              <span className="text-sm text-[var(--text-dim)]">{roundsText(rounds)}</span>
            </div>
          )}
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
 * Choosing rows, then throwing them away, as three states rather than two.
 *
 * `view` is the screen as it has always been. `select` puts a tick beside every
 * row and a count in the bar. `confirm` is the one that matters: it replaces
 * the bar with a plain sentence saying how many sessions are about to go and
 * that they are not coming back, and it puts the destructive control BESIDE a
 * way out rather than under a thumb that was already moving.
 *
 * Two taps and a state change, rather than one tap and a native `confirm()`.
 * The runner is built around the rule that nothing may delete a session that
 * happened; this is the single deliberate exception, so it is made to feel like
 * one instead of like an ordinary tap that happens to be final.
 */
type Mode = 'view' | 'select' | 'confirm';

/**
 * Everything he has done, newest first, each row opening into what was in it.
 *
 * Thirty sessions is the whole store, so there is no paging and no search: a
 * list this long is read by scrolling, and anything cleverer would be building
 * for a scale this app has decided not to have.
 */
export function HistoryScreen() {
  const history = useHistory();
  const [mode, setMode] = useState<Mode>('view');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const leave = (): void => {
    setMode('view');
    setPicked(new Set());
  };

  const toggle = (id: string): void =>
    setPicked((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const remove = (): void => {
    removeEntries(picked);
    leave();
  };

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

  const count = picked.size;
  const sessions = `${count} ${count === 1 ? 'workout' : 'workouts'}`;

  return (
    <div className="flex flex-col gap-3">
      {mode === 'confirm' ? (
        <Card className="flex flex-col gap-3">
          <p className="text-base font-bold">{`Delete ${sessions}?`}</p>
          <p className="text-sm text-[var(--text-dim)]">
            They are gone for good - there is no undo and no copy anywhere else.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setMode('select')}>
              Keep them
            </Button>
            <Button variant="danger" onClick={remove}>
              {`Delete ${sessions}`}
            </Button>
          </div>
        </Card>
      ) : mode === 'select' ? (
        <div className="flex gap-3">
          <Button variant="ghost" onClick={leave}>
            Cancel
          </Button>
          <Button variant="danger" disabled={count === 0} onClick={() => setMode('confirm')}>
            {count === 0 ? 'Delete' : `Delete ${sessions}`}
          </Button>
        </div>
      ) : (
        <Button variant="ghost" fullWidth={false} className="self-start" onClick={() => setMode('select')}>
          Select
        </Button>
      )}

      {newestFirst(history).map((entry) => (
        <Row
          key={entry.id}
          entry={entry}
          selecting={mode !== 'view'}
          selected={picked.has(entry.id)}
          onToggle={() => toggle(entry.id)}
        />
      ))}
    </div>
  );
}
