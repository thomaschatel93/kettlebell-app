'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AncillaryChecklist } from '@/components/AncillaryChecklist';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ExerciseCard } from '@/components/ExerciseCard';
import { ProgressBar } from '@/components/ProgressBar';
import { RestCard } from '@/components/RestCard';
import { isActiveHydrated, publishActive, useActiveWorkout } from '@/lib/active-store';
import { nowMs, tick as readClock } from '@/lib/clock';
import { ALL_EXERCISES } from '@/lib/data/ancillary';
import { pushHistory, type ActiveState } from '@/lib/storage';
import type { Exercise, HistoryEntry, Step, WorkStep, Workout } from '@/lib/types';
import { useAudioCues } from '@/lib/useAudioCues';
import { useWakeLock } from '@/lib/useWakeLock';

/**
 * The screen the whole app exists for.
 *
 * It holds NO programming logic. The workout arrives as a flat `Step[]` and
 * this walks it; every decision about what comes next was made by the engine
 * before he ever tapped start.
 *
 * Three things here are not style choices:
 *
 * 1. THE CLOCK, NEVER A COUNTER. `restEndsAt` is an absolute epoch millisecond
 *    value and the remaining time is derived from the clock on every tick and
 *    every mount. iOS throttles intervals in a backgrounded tab, stops them
 *    when the screen dims, and evicts standalone web apps outright; a stored
 *    number that gets decremented drifts, stalls, and comes back reading full.
 *    `workedSeconds` is measured the same way, from the gap between two clock
 *    readings, and it runs on EVERY step - an earlier design accumulated it
 *    only during rests, which would have written a zero into every history
 *    record of a workout with no rests in it.
 *
 * 2. AT ZERO THE REST DOES NOT VANISH. Where the app does not advance by
 *    itself, the reading keeps going upward and says how far over he is. The
 *    number he wants at that moment is how long he has actually been resting.
 *
 * 3. NO WAY TO LOSE A SESSION. Previous is always live and never asks twice,
 *    because wet hands produce phantom taps and there has to be a way back.
 *    Exit splits in two: leaving keeps the session for Home to resume, ending
 *    writes a partial record first. Nothing here deletes a session that
 *    happened.
 */

/** Four times a second: fast enough that a second never visibly sticks. */
const TICK_MS = 250;
/** The last three seconds get a tick each; zero gets the tone. */
const CUE_FROM = 3;
const ADD_MS = 30_000;

const BY_ID: ReadonlyMap<string, Exercise> = new Map(ALL_EXERCISES.map((e) => [e.id, e]));

/**
 * Warm-up and cool-down are lists, not hero cards.
 *
 * The warm-up runs first in every session, so a card per move meant every
 * session opened with a run of near-empty placeholders being tapped through.
 * One block, one card, worked down at his own pace.
 */
const isAncillary = (s: Step): boolean => s.block !== 'Main';

/**
 * The stretch of steps the current screen stands for: one step in the Main
 * block, or a whole contiguous ancillary block. `stepIndex` always points at
 * the start of one of these, so Next and Previous move a screen at a time
 * rather than stranding him halfway inside a checklist he cannot see.
 */
function unitRange(steps: Step[], index: number): { start: number; end: number } {
  const step = steps[index];
  if (step === undefined || !isAncillary(step)) return { start: index, end: index };

  let start = index;
  while (start > 0 && steps[start - 1].block === step.block) start -= 1;
  let end = index;
  while (end < steps.length - 1 && steps[end + 1].block === step.block) end += 1;
  return { start, end };
}

/**
 * Which round he is on, taken from the nearest work step at or before the
 * current one - a rest carries no round of its own, and "Round 2 of 3" is
 * exactly the thing he wants during the rest before round two.
 *
 * Silent for a single-round block: "Round 1 of 1" is a fact about nothing.
 */
function roundLabel(steps: Step[], index: number): string {
  for (let i = Math.min(index, steps.length - 1); i >= 0; i -= 1) {
    const s = steps[i];
    if (s.kind !== 'work') continue;
    return s.totalRounds > 1 ? `Round ${s.round} of ${s.totalRounds}` : '';
  }
  return '';
}

function movePosition(step: Step | undefined): string {
  if (step === undefined || step.kind !== 'work' || step.itemsInRound <= 1) return '';
  return `Move ${step.indexInRound} of ${step.itemsInRound}`;
}

/**
 * What the generator reads back to keep the next session varied: the distinct
 * Main-block moves he actually performed. Warm-up and cool-down are excluded
 * deliberately - they repeat by design and would drown the signal.
 */
const mainExerciseIds = (steps: Step[]): string[] => [
  ...new Set(
    steps
      .filter((s): s is WorkStep => s.kind === 'work' && s.block === 'Main')
      .map((s) => s.exerciseId),
  ),
];

/**
 * `done` is the steps to credit him with, which is the whole list on Finish and
 * only what he got through when he ends early. The workout itself is stored
 * whole either way, so history can still show what the session was meant to be.
 */
function historyEntry(workout: Workout, done: Step[], workedSeconds: number): HistoryEntry {
  const at = readClock();
  return {
    id: `h-${at.seed}`,
    createdAt: at.now,
    workout,
    mainExerciseIds: mainExerciseIds(done),
    workedSeconds: Math.round(workedSeconds),
  };
}

export function WorkoutRunner() {
  const router = useRouter();
  const active = useActiveWorkout();
  const [paused, setPaused] = useState(false);
  // Lazily initialised, so the very first paint of a resumed rest is already
  // right rather than waiting 250ms for the first tick to correct it.
  const [now, setNow] = useState(nowMs);
  const { unlock, tick: tickCue, go } = useAudioCues();

  /** The clock reading the current worked-time slice is measured from. */
  const lastTick = useRef(0);
  /** Worked seconds counted but not yet written, so storage is touched once a second, not four times. */
  const pending = useRef(0);
  /** The countdown second a cue has already been played for, so one cue is one cue. */
  const cued = useRef<number | null>(null);
  /** The step already auto-advanced out of, so a burst of ticks cannot skip two. */
  const advancedFrom = useRef<number | null>(null);

  const state = isActiveHydrated(active) ? active : null;
  const steps = state?.workout.steps ?? [];
  const range = unitRange(steps, state?.stepIndex ?? 0);
  const current: Step | undefined = steps[range.start];
  const nextStep: Step | undefined = steps[range.end + 1];
  const isLast = steps.length > 0 && range.end >= steps.length - 1;
  const running = state !== null && !paused;

  /**
   * Derived from the clock on every render, never stored and never decremented.
   * A throttled or fully stalled interval therefore catches up on its next tick
   * instead of resuming from the top.
   */
  const liveRemaining =
    state?.restEndsAt != null && !paused ? Math.ceil((state.restEndsAt - now) / 1000) : null;
  /** What the card shows, which includes the frozen reading while paused. */
  const shownRemaining =
    liveRemaining ??
    (state?.pausedRemainingMs != null ? Math.ceil(state.pausedRemainingMs / 1000) : null);

  /**
   * A rest runs into the next step by itself, EXCEPT at the end of a block or
   * the end of the workout. Changing from warm-up to main deserves a deliberate
   * tap; being tipped into it while still on the floor does not.
   */
  const autoAdvance =
    current?.kind === 'rest' && nextStep !== undefined && nextStep.block === current.block;

  useWakeLock(state !== null && !paused);

  /** iOS wants a real gesture before it will ever play a cue. Any tap will do. */
  useEffect(() => {
    unlock();
  }, [unlock]);

  /**
   * Every write goes through here so that worked time counted since the last
   * write is flushed with it. Without that, tapping Next a few hundred
   * milliseconds into a second quietly throws that fraction away on every step.
   */
  const mutate = useCallback((fn: (s: ActiveState) => ActiveState): void => {
    const add = pending.current;
    pending.current = 0;
    publishActive((s) => (s === null ? s : fn({ ...s, workedSeconds: s.workedSeconds + add })));
  }, []);

  const goTo = useCallback(
    (target: number): void => {
      cued.current = null;
      advancedFrom.current = null;
      mutate((s) => {
        const start = unitRange(s.workout.steps, target).start;
        const step = s.workout.steps[start];
        if (step === undefined) return s;
        return {
          ...s,
          stepIndex: start,
          // Entering a rest stamps the deadline; entering anything else clears
          // it. One place, so a stale deadline cannot survive a step change.
          restEndsAt: step.kind === 'rest' ? nowMs() + step.seconds * 1000 : null,
          pausedRemainingMs: null,
        };
      });
    },
    [mutate],
  );

  /**
   * One interval for the whole session. It repaints and it measures; it never
   * decrements anything.
   *
   * `setNow` here is a timer callback rather than an effect body, which is the
   * difference between a subscription and the cascading render Next 16 rejects.
   */
  useEffect(() => {
    if (!running) {
      lastTick.current = nowMs();
      return;
    }
    lastTick.current = nowMs();

    const id = setInterval(() => {
      const t = nowMs();
      const delta = (t - lastTick.current) / 1000;
      lastTick.current = t;
      setNow(t);

      // Measured from the clock, so time the browser spent not running this
      // callback is still counted rather than lost.
      if (delta > 0) pending.current += delta;
      if (pending.current >= 1) mutate((s) => s);
    }, TICK_MS);

    return () => clearInterval(id);
  }, [running, mutate]);

  /** The three ticks, the tone, and the hand-off at zero. */
  useEffect(() => {
    if (liveRemaining === null) return;

    if (liveRemaining > 0) {
      if (liveRemaining <= CUE_FROM && cued.current !== liveRemaining) {
        cued.current = liveRemaining;
        tickCue();
      }
      return;
    }

    if (cued.current !== 0) {
      cued.current = 0;
      go();
    }

    if (!autoAdvance || advancedFrom.current === range.start) return;
    advancedFrom.current = range.start;
    goTo(range.start + 1);
  }, [liveRemaining, autoAdvance, range.start, goTo, tickCue, go]);

  const onPrevious = (): void => {
    unlock();
    setPaused(false);
    // Never disabled and never confirmed. At the very first step there is
    // simply nowhere behind to go.
    if (range.start > 0) goTo(unitRange(steps, range.start - 1).start);
  };

  const onNext = (): void => {
    unlock();
    setPaused(false);
    if (!isLast) goTo(range.end + 1);
  };

  const onPause = (): void => {
    unlock();
    const t = nowMs();
    // The deadline is banked as a duration and the deadline itself dropped, so
    // a paused rest cannot silently expire while he is answering the door.
    mutate((s) => ({
      ...s,
      restEndsAt: null,
      pausedRemainingMs: s.restEndsAt === null ? null : s.restEndsAt - t,
    }));
    setPaused(true);
  };

  const onResume = (): void => {
    unlock();
    const t = nowMs();
    mutate((s) => ({
      ...s,
      restEndsAt: s.pausedRemainingMs === null ? null : t + s.pausedRemainingMs,
      pausedRemainingMs: null,
    }));
    setNow(t);
    setPaused(false);
  };

  const onAddTime = (): void => {
    unlock();
    // He has asked for more rest, so the cues and the hand-off are re-armed.
    cued.current = null;
    advancedFrom.current = null;
    mutate((s) => ({
      ...s,
      restEndsAt: s.restEndsAt === null ? null : s.restEndsAt + ADD_MS,
      pausedRemainingMs: s.pausedRemainingMs === null ? null : s.pausedRemainingMs + ADD_MS,
    }));
  };

  const record = (done: Step[]): void => {
    if (state === null) return;
    const worked = state.workedSeconds + pending.current;
    pending.current = 0;
    pushHistory(historyEntry(state.workout, done, worked));
    publishActive(null);
    router.push('/workout/done');
  };

  const onFinish = (): void => record(steps);
  /** A partial record, written BEFORE the session is cleared. */
  const onEndHere = (): void => record(steps.slice(0, range.start));

  const onLeaveForNow = (): void => {
    mutate((s) => s);
    router.push('/');
  };

  if (!isActiveHydrated(active)) {
    return <p className="px-4 py-10 text-base font-medium">Reading your workout…</p>;
  }

  if (state === null || current === undefined) {
    return (
      <div className="read-far mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-10">
        <Card className="flex flex-col gap-3">
          <p className="text-xl font-bold">No workout in progress.</p>
          <p className="text-base font-medium">
            Nothing was lost - there is just nothing running right now.
          </p>
          <Button onClick={() => router.push('/workout')}>Set one up</Button>
        </Card>
      </div>
    );
  }

  const round = roundLabel(steps, range.start);
  // The checklist carries the block as its own heading, so repeating it in the
  // header is just the same word twice - and "Move 1 of 3" is a lie about a
  // block that is one screen, not three.
  const checklist = isAncillary(current);
  const move = checklist ? '' : movePosition(current);

  return (
    // `.read-far` reassigns --text-dim to full strength for everything below,
    // so grey-on-near-black cannot get onto this screen by accident. The tap
    // handler is the audio unlock: any tap counts as the gesture iOS wants.
    <div
      className="read-far mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5"
      onPointerDown={unlock}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            {!checklist && (
              <p className="text-sm font-bold uppercase tracking-widest text-[var(--text)]">
                {current.block}
              </p>
            )}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              {round && <p className="text-lg font-bold tracking-tight text-[var(--text)]">{round}</p>}
              {move && <p className="text-base font-medium text-[var(--text)]">{move}</p>}
            </div>
          </div>

          {/*
            Exit stays up here, where a mis-tap is least likely, and that is the
            whole reason it is up here. Pause went the other way, down beside
            Next: the phone is on the floor and the top edge is the furthest
            reach and the worst target from a crouch.

            A native <details>, so the two ways out are one tap apart, work
            before hydration, and take a keyboard for nothing.
          */}
          <details className="relative shrink-0">
            <summary className="tap-target inline-flex cursor-pointer list-none items-center justify-center
              rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-5 py-2.5
              text-base font-bold text-[var(--text)]">
              Exit
            </summary>
            <div className="absolute right-0 z-10 mt-2 flex w-72 flex-col gap-2 rounded-[var(--radius)]
              border border-[var(--border)] bg-[var(--surface-2)] p-3 shadow-lg">
              <p className="text-sm font-medium leading-snug text-[var(--text)]">
                Leaving keeps the session so you can pick it up from Home. Ending saves what you have
                done so far.
              </p>
              <Button variant="ghost" onClick={onLeaveForNow}>
                Leave for now
              </Button>
              <Button variant="danger" onClick={onEndHere}>
                End here
              </Button>
            </div>
          </details>
        </div>

        <ProgressBar value={range.start} max={steps.length} label="Workout progress" />
      </header>

      <main className="flex flex-1 flex-col justify-center">
        {isAncillary(current) ? (
          <AncillaryChecklist
            steps={steps.slice(range.start, range.end + 1)}
            exercises={BY_ID}
            onDone={onNext}
          />
        ) : current.kind === 'rest' ? (
          <RestCard
            remainingSeconds={shownRemaining ?? current.seconds}
            nextName={current.nextName}
            onSkip={onNext}
            onAddTime={onAddTime}
          />
        ) : (
          <ExerciseCard step={current} exercise={BY_ID.get(current.exerciseId) ?? null} />
        )}
      </main>

      {/*
        Pinned, because a card with a picture and three cues on it is taller
        than the phone and the controls were ending up below the fold - on the
        one screen where nothing may need scrolling to. `safe-bottom` holds the
        last row clear of the home indicator.

        Pause sits here beside Next because that is where his thumb already is;
        Previous is directly above, always live and never confirmed. Exit stayed
        in the header, where a mis-tap is least likely, and that is exactly why
        it stayed there.
      */}
      <div className="safe-bottom sticky bottom-0 z-20 -mx-4 flex flex-col gap-3 border-t
        border-[var(--border)] bg-[var(--bg)] px-4 pb-3 pt-3">
        <div role="status" className="min-h-6">
          {paused && (
            <p className="text-center text-base font-bold uppercase tracking-widest text-[var(--accent)]">
              Paused
            </p>
          )}
        </div>

        <Button variant="ghost" onClick={onPrevious}>
          Previous
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={paused ? onResume : onPause}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button onClick={isLast ? onFinish : onNext}>{isLast ? 'Finish' : 'Next'}</Button>
        </div>
      </div>
    </div>
  );
}
