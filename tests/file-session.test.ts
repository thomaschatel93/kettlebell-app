import { describe, it, expect, beforeEach } from 'vitest';
import { fileSession } from '@/lib/file-session';
import { loadActive, loadHistory, saveActive } from '@/lib/storage';
import { req } from './fixtures';
import type { ActiveState } from '@/lib/storage';
import type { Step, Workout } from '@/lib/types';

const step = (name: string): Step => ({
  kind: 'work', exerciseId: 'two-hand-swing', name, bellKg: 16, reps: 10,
  block: 'Main', round: 1, totalRounds: 3, indexInRound: 1, itemsInRound: 3, estSeconds: 30,
});

const workout: Workout = {
  id: 'w', createdAt: '2026-08-25T09:00:00.000Z', request: req(), format: 'circuit',
  steps: [step('A'), step('B'), step('C')], estimatedSeconds: 900,
  loadWarning: false, shortOfBudget: false,
};

const state = (over: Partial<ActiveState> = {}): ActiveState => ({
  v: 1, workout, stepIndex: 2, workedSeconds: 300, restEndsAt: null, pausedRemainingMs: null, ...over,
});

beforeEach(() => localStorage.clear());

describe('fileSession', () => {
  /**
   * The rule the whole module exists for: nothing in this app deletes a session
   * that happened. Whatever the route out of a live workout - a new one
   * generated over the top, or one left too long to resume - it is filed first.
   */
  it('files a started session to history and releases the slot', () => {
    saveActive(state());
    const written = fileSession(loadActive());
    expect(written).not.toBeNull();
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].workedSeconds).toBe(300);
    expect(loadActive()).toBeNull();
  });

  it('credits only the steps he got through, as ending early does', () => {
    saveActive(state({ stepIndex: 2 }));
    fileSession(loadActive());
    // Two steps done, and the whole workout kept, so History can still show it.
    expect(loadHistory()[0].mainExerciseIds).toEqual(['two-hand-swing']);
    expect(loadHistory()[0].workout.steps).toHaveLength(3);
  });

  /**
   * A workout generated and never begun is not a session. Filing it would put a
   * row in History for something that did not happen, and feed the anti-repeat
   * rule moves he never performed.
   */
  it('writes no record for a workout that was never started, but still frees the slot', () => {
    saveActive(state({ stepIndex: 0, workedSeconds: 0 }));
    expect(fileSession(loadActive())).toBeNull();
    expect(loadHistory()).toHaveLength(0);
    expect(loadActive()).toBeNull();
  });

  it('does nothing at all when there is no session', () => {
    expect(fileSession(null)).toBeNull();
    expect(loadHistory()).toHaveLength(0);
  });
});
