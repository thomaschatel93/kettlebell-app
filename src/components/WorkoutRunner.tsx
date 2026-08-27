'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ExerciseCard } from '@/components/ExerciseCard';
import { ProgressBar } from '@/components/ProgressBar';
import { RestCard } from '@/components/RestCard';
import { isActiveHydrated, publishActive, useActiveWorkout } from '@/lib/active-store';
import { mmss, nowMs, tick as readClock } from '@/lib/clock';
import { ALL_EXERCISES } from '@/lib/data/ancillary';
import { type ActiveState } from '@/lib/storage';
import { appendHistory } from '@/lib/history-store';
import { historyEntry } from '@/lib/record';
import type { Exercise, Step, WorkStep } from '@/lib/types';
import { useAudioCues } from '@/lib/useAudioCues';
import { useWakeLock } from '@/lib/useWakeLock';

/**
 * The screen the whole app exists for.
 *
 * It holds NO programming logic. The workout arrives as a flat `Step[]` and
 * this walks it, one step to a screen; every decision about what comes next was
 * made by the engine before he ever tapped start.
 *
 * Four things here are not style choices:
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
 * 3. THAT WORKED CLOCK IS ON SCREEN. It ran from the first build and was shown
 *    nowhere, which left Pause looking like a control that did nothing: on a
 *    work step there was no moving number for it to stop. It now sits directly
 *    above Pause, so the button and the thing it acts on are the same glance.
 *
 * 4. NO WAY TO LOSE A SESSION. Previous is always live and never asks twice,
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
 * The steps that get a screen, which is not quite all of them.
 *
 * Warm-up and cool-down are full cards now, one move to a screen, the same as
 * the main block - but the plan also carries fifteen seconds between one
 * ancillary move and the next, and those are not rests. They are the seconds
 * the budget allows for walking to the mat. Standing in front of a countdown
 * seven times during a warm-up is the opposite of warming up, and it would
 * sound forty-eight extra cues in the first three minutes of every session.
 *
 * So a rest gets a screen only in the Main block, where it is a real rest with
 * a real reason to be timed. The step stays in the list, keeps its place in the
 * estimate, and is simply walked past; worked time is measured from the clock
 * either way, so the record stays honest about what actually happened.
 */
const shownIndices = (steps: Step[]): number[] =>
  steps.reduce<number[]>((acc, s, i) => {
    if (s.kind === 'work' || s.block === 'Main') acc.push(i);
    return acc;
  }, []);

/**
 * The work step the header speaks for.
 *
 * A rest carries no round of its own, and it belongs to what comes NEXT: the
 * card is already saying "Next: <a round two move>", so a header reading "Round
 * 1 of 4" beside it reads as a bug. It names the round he is about to do.
 */
function governingWork(steps: Step[], index: number): WorkStep | undefined {
  const here = steps[index];
  if (here?.kind === 'work') return here;

  for (let i = index + 1; i < steps.length; i += 1) {
    const s = steps[i];
    if (s.kind === 'work') return s;
  }
  // A rest with no work left after it falls back to what it followed.
  for (let i = index - 1; i >= 0; i -= 1) {
    const s = steps[i];
    if (s.kind === 'work') return s;
  }
  return undefined;
}

/** Silent for a single-round block: "Round 1 of 1" is a fact about nothing. */
function roundLabel(steps: Step[], index: number): string {
  const s = governingWork(steps, index);
  if (s === undefined || s.totalRounds <= 1) return '';
  return `Round ${s.round} of ${s.totalRounds}`;
}

function movePosition(step: Step | undefined): string {
  if (step === undefined || step.kind !== 'work' || step.itemsInRound <= 1) return '';
  return `Move ${step.indexInRound} of ${step.itemsInRound}`;
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
  const shown = shownIndices(steps);
  /**
   * Where he is in the list of screens, not in the list of steps.
   *
   * Clamped forward rather than snapped back: a stored position pointing at a
   * skipped rest - an older session, or a build before those were skipped -
   * resolves to the next real screen instead of a blank one. Nothing is written
   * to fix it, because the first tap writes the corrected index anyway.
   */
  const at = Math.max(0, shown.findIndex((i) => i >= (state?.stepIndex ?? 0)));
  const index = shown[at] ?? 0;
  const current: Step | undefined = steps[index];
  const nextStep: Step | undefined = steps[index + 1];
  const isLast = shown.length > 0 && at >= shown.length - 1;
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
        const step = s.workout.steps[target];
        if (step === undefined) return s;
        return {
          ...s,
          stepIndex: target,
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

    if (!autoAdvance || advancedFrom.current === index) return;
    advancedFrom.current = index;
    goTo(index + 1);
  }, [liveRemaining, autoAdvance, index, goTo, tickCue, go]);

  const onPrevious = (): void => {
    unlock();
    setPaused(false);
    // Never disabled and never confirmed. At the very first screen there is
    // simply nowhere behind to go.
    const back = shown[at - 1];
    if (back !== undefined) goTo(back);
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

  /**
   * Everything that means "I am done with this screen" comes through here:
   * Next and Skip rest. It finishes the session when there is nothing after the
   * current step, rather than silently doing nothing.
   *
   * That no-op is what this replaces, and it was not a nicety. Routing the last
   * screen's control to a Next that did nothing meant he taps the obvious
   * control at the end of every session and the app ignores him.
   */
  const onAdvance = (): void => {
    unlock();
    setPaused(false);
    if (isLast) {
      record(steps);
      return;
    }
    goTo(shown[at + 1] ?? index);
  };

  const record = (done: Step[]): void => {
    if (state === null) return;
    const worked = state.workedSeconds + pending.current;
    pending.current = 0;
    // Appended through the shared store, not written straight to storage: the
    // Done screen mounts from this same store a moment later with no reload in
    // between, so a bare write would leave it showing the session before last.
    appendHistory(historyEntry(state.workout, done, worked, readClock()));
    publishActive(null);
    router.push('/workout/done');
  };

  /** A partial record, written BEFORE the session is cleared. */
  const onEndHere = (): void => record(steps.slice(0, index));

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

  const round = roundLabel(steps, index);
  const move = movePosition(current);
  /**
   * One line, not three stacked ones.
   *
   * The header used to spend a block label, a round line and a move line on
   * three separate rows - sixty-odd pixels of the phone given over to something
   * he glances at between sets, taken from the picture he looks at during them.
   * Run together with separators it says the same three things in the height of
   * one.
   */
  const place = [current.block, round, move].filter(Boolean).join(' · ');
  /**
   * The stored reading, not the stored reading plus the unflushed fraction.
   *
   * The fraction lives in a ref, and a ref read during render is exactly what
   * Next 16's ruleset rejects - rightly, since nothing re-renders when it
   * changes. It costs nothing here: the interval flushes whole seconds into the
   * store as they accrue, so this advances once a second on its own, which is
   * the only resolution a `m:ss` reading has anyway.
   */
  const worked = Math.floor(state.workedSeconds);

  return (
    // `.read-far` reassigns --text-dim to full strength for everything below,
    // so grey-on-near-black cannot get onto this screen by accident. The tap
    // handler is the audio unlock: any tap counts as the gesture iOS wants.
    <div
      /*
       * An exact box, not `flex-1`. `.app-shell` sizes the body with
       * `min-height`, which is not a definite height: a flex child of it grows
       * with its content instead of being bounded by it, so `min-h-0` and
       * `overflow-y-auto` further down had nothing to resolve against and the
       * control bar slid off the bottom of the phone. Subtracting the safe-area
       * inset here matches what the shell's own bottom padding takes, so the
       * two agree and the page itself never scrolls.
       */
      className="read-far mx-auto flex h-[calc(100dvh_-_env(safe-area-inset-bottom))] w-full
        max-w-md flex-col gap-2 px-4 py-3"
      onPointerDown={unlock}
    >
      <header className="flex shrink-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm font-bold uppercase tracking-wide text-[var(--text)]">
            {place}
          </p>

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
              rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2
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

        <ProgressBar value={at} max={shown.length} label="Workout progress" />
      </header>

      {/*
        The one scrolling region on the screen, bounded above by the header and
        below by the controls. An exercise card fills it exactly and does not
        scroll; it only overflows once he has opened a set of cues himself. A
        rest is centred in it, because a countdown wants the middle of the
        screen and has nothing to fill it with.
      */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {current.kind === 'rest' ? (
          // `my-auto` rather than `justify-center`: a centred flex child that
          // overflows its scroll container cannot be scrolled back up to.
          <div className="my-auto">
            <RestCard
              remainingSeconds={shownRemaining ?? current.seconds}
              nextName={current.nextName}
              onSkip={onAdvance}
              onAddTime={onAddTime}
            />
          </div>
        ) : (
          <ExerciseCard step={current} exercise={BY_ID.get(current.exerciseId) ?? null} />
        )}
      </main>

      {/*
        A flex sibling of the scrolling region rather than a sticky overlay.
        Sticky kept the controls on screen but floated them OVER the card, and
        a card's own footer ended up half behind the bar - a control that looks
        broken, sitting next to one that was. Nothing can be behind this now:
        the screen is exactly the height of the phone and only the middle
        scrolls. `.app-shell` already holds the body clear of the home
        indicator, so this needs no inset of its own.

        Pause sits here beside Next because that is where his thumb already is;
        Previous is directly above, always live and never confirmed. Exit stayed
        in the header, where a mis-tap is least likely, and that is exactly why
        it stayed there.
      */}
      <div className="-mx-4 flex shrink-0 flex-col gap-2 border-t border-[var(--border)]
        bg-[var(--bg)] px-4 pb-1 pt-2">
        {/*
          The worked clock, right above the button that stops it.

          It is the answer to a Pause that looked broken: on a work step nothing
          on screen moved, so stopping it looked like nothing happening either.
          A live region rather than a plain line, so the change of state is
          announced once rather than every second - `aria-live` on a number that
          ticks would read the whole session out loud.
        */}
        <div className="flex items-baseline justify-center gap-2 text-base font-bold uppercase tracking-widest">
          <span className={paused ? 'text-[var(--accent)]' : 'text-[var(--text)]'} role="status">
            {paused ? 'Paused' : 'Worked'}
          </span>
          <span className={`tabular-nums ${paused ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
            {mmss(worked)}
          </span>
        </div>

        <Button variant="ghost" onClick={onPrevious}>
          Previous
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={paused ? onResume : onPause}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button onClick={onAdvance}>{isLast ? 'Finish' : 'Next'}</Button>
        </div>
      </div>
    </div>
  );
}
