import type { Tick } from '@/lib/clock';
import type { ActiveState } from '@/lib/storage';
import type { HistoryEntry, Step, WorkStep, Workout } from '@/lib/types';

/* ---------------------------------------------------------------------------
   Turning a session into a record.

   This was written inside the runner, where it was only ever reachable by
   finishing or ending a workout on purpose. It is out here now because there
   are two other ways a live session stops being live - he generates a new one
   over the top of it, and he walks away and comes back days later - and in
   both of those the work used to be deleted without a word.

   The rule this file exists to keep: nothing in this app deletes a session that
   happened. Whatever the route out of a workout, it goes through here first.

   Pure, and it reads no clock: the caller passes one `Tick`, so the id and the
   timestamp always come off the same reading.
--------------------------------------------------------------------------- */

/**
 * What the generator reads back to keep the next session varied: the distinct
 * Main-block moves he actually performed. Warm-up and cool-down are excluded
 * deliberately - they repeat by design and would drown the signal.
 */
export const mainExerciseIds = (steps: Step[]): string[] => [
  ...new Set(
    steps
      .filter((s): s is WorkStep => s.kind === 'work' && s.block === 'Main')
      .map((s) => s.exerciseId),
  ),
];

/**
 * `done` is the steps to credit him with, which is the whole list on Finish and
 * only what he got through when he stops early. The workout itself is stored
 * whole either way, so history can still show what the session was meant to be.
 */
export function historyEntry(
  workout: Workout,
  done: Step[],
  workedSeconds: number,
  at: Tick,
): HistoryEntry {
  return {
    id: `h-${at.seed}`,
    createdAt: at.now,
    workout,
    mainExerciseIds: mainExerciseIds(done),
    workedSeconds: Math.round(workedSeconds),
  };
}

/**
 * Whether a live session is worth keeping at all.
 *
 * A workout generated and never begun is not a session: filing it would put a
 * row in History for something that did not happen, and hand the anti-repeat
 * rule a list of moves he never performed. Anything past the first step, or
 * with a second of work on the clock, did happen.
 */
export const wasStarted = (state: ActiveState): boolean =>
  state.workedSeconds > 0 || state.stepIndex > 0;

/** The record of a session that stopped without anyone pressing Finish. */
export const partialEntry = (state: ActiveState, at: Tick): HistoryEntry =>
  historyEntry(state.workout, state.workout.steps.slice(0, state.stepIndex), state.workedSeconds, at);
