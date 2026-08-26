import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WorkoutRunner } from '@/components/WorkoutRunner';
import { saveActive, loadActive, loadHistory } from '@/lib/storage';
import type { Step, Workout } from '@/lib/types';
import { req } from '../fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const work = (name: string, over: Partial<Step> = {}): Step => ({
  kind: 'work', exerciseId: name.toLowerCase().replace(/ /g, '-'), name, bellKg: 16, reps: 10,
  block: 'Main', round: 1, totalRounds: 2, indexInRound: 1, itemsInRound: 1, estSeconds: 20, ...over,
} as Step);
const rest = (seconds: number, nextName: string): Step =>
  ({ kind: 'rest', seconds, nextName, block: 'Main', estSeconds: seconds });

const workout = (steps: Step[]): Workout => ({
  id: 'w1', createdAt: '2026-08-25T09:00:00.000Z', format: 'circuit', steps,
  estimatedSeconds: steps.reduce((a, s) => a + s.estSeconds, 0),
  request: req(), loadWarning: false, shortOfBudget: false,
});

const seed = (steps: Step[], stepIndex = 0) =>
  saveActive({ v: 1, workout: workout(steps), stepIndex, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null });

const THREE = () => [work('Swing'), rest(30, 'Goblet Squat'), work('Goblet Squat')];

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-25T09:00:00.000Z'));
  seed(THREE());
});
afterEach(() => vi.useRealTimers());

describe('WorkoutRunner', () => {
  it('shows the first exercise, its bell and its prescription', () => {
    render(<WorkoutRunner />);
    screen.getByRole('heading', { name: 'Swing' });
    screen.getByText('16 kg');
    screen.getByText('10 reps');
  });

  it('advances on Next and saves the position', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    screen.getByText('Next: Goblet Squat');
    expect(loadActive()!.stepIndex).toBe(1);
  });

  it('goes back with no confirmation', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    screen.getByRole('heading', { name: 'Swing' });
    expect(loadActive()!.stepIndex).toBe(0);
  });

  it('counts the rest down from an absolute deadline and advances by itself', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(loadActive()!.restEndsAt).toBe(Date.now() + 30_000);
    act(() => { vi.advanceTimersByTime(30_000); });
    screen.getByRole('heading', { name: 'Goblet Squat' });
  });

  it('survives a stalled timer, because the deadline is absolute', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    // The clock moves but the interval does not fire, as when iOS throttles a
    // backgrounded tab. One tick afterwards must catch up, not resume from 30.
    act(() => { vi.setSystemTime(Date.now() + 29_000); vi.advanceTimersByTime(250); });
    expect(screen.getByText('0:01')).toBeDefined();
  });

  it('resumes a rest at the right point after a remount', () => {
    const now = Date.now();
    saveActive({
      v: 1, workout: workout(THREE()), stepIndex: 1, workedSeconds: 60,
      restEndsAt: now + 12_000, pausedRemainingMs: null,
    });
    render(<WorkoutRunner />);
    screen.getByText('0:12');
  });

  it('freezes the countdown while paused and restores it on resume', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => { vi.advanceTimersByTime(30_000); });
    screen.getByRole('heading', { name: 'Rest' });

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    act(() => { vi.advanceTimersByTime(30_000); });
    screen.getByRole('heading', { name: 'Goblet Squat' });
  });

  it('adds thirty seconds to a rest', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const before = loadActive()!.restEndsAt!;
    fireEvent.click(screen.getByRole('button', { name: '+30s' }));
    expect(loadActive()!.restEndsAt).toBe(before + 30_000);
  });

  it('accumulates worked time on work steps, not only on rests', () => {
    render(<WorkoutRunner />);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(loadActive()!.workedSeconds).toBeGreaterThanOrEqual(9);
  });

  it('does not accumulate worked time while paused', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(loadActive()!.workedSeconds).toBeLessThan(2);
  });

  it('shows the position within the round', () => {
    render(<WorkoutRunner />);
    screen.getByText('Round 1 of 2');
  });

  it('writes history and clears the active workout at the end', () => {
    seed([work('Swing')]);
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].mainExerciseIds).toEqual(['swing']);
    expect(loadHistory()[0].workout.id).toBe('w1');
    expect(loadActive()).toBeNull();
    expect(push).toHaveBeenCalledWith('/workout/done');
  });

  it('keeps the session when leaving for now', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: /leave for now/i }));
    expect(loadActive()).not.toBeNull();
    expect(loadHistory()).toHaveLength(0);
  });

  it('writes a partial record when ending early, never discarding the session', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: /end here/i }));
    expect(loadHistory()).toHaveLength(1);
    expect(loadActive()).toBeNull();
  });
});

/**
 * Sound is the only channel that reaches him. Everything else on this screen
 * assumes the phone is a metre away on the floor, so a cue he cannot hear
 * mid-plank is a cue that does not exist - and vibration is no substitute,
 * because `navigator.vibrate` does not exist on iOS Safari at all.
 */
describe('WorkoutRunner audio cues', () => {
  /** Which cue file each play() reached for, in order. */
  const played: string[] = [];

  beforeEach(() => {
    played.length = 0;
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      played.push(this.src.split('/').pop() ?? '');
      return Promise.resolve();
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  /**
   * The unlock plays both elements muted from inside the gesture, which is the
   * only thing iOS accepts as permission to play anything later. Waiting for it
   * here is not ceremony: it settles on a microtask, and a synchronous test
   * would run to the end before it ever did.
   */
  const start = async (): Promise<void> => {
    render(<WorkoutRunner />);
    await act(async () => {});
    expect(played).toEqual(['tick.mp3', 'go.mp3']);
    played.length = 0;
  };

  const advance = (ms: number): void => { act(() => { vi.advanceTimersByTime(ms); }); };

  it('ticks at three, two and one, then sounds the tone at zero - once each', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Twenty-seven seconds in and nothing has sounded: the cues belong to the
    // last three seconds, not to the rest as a whole.
    advance(26_000);
    expect(played).toEqual([]);

    // A second at a time from here. The interval runs four times a second, so
    // this is also the test that one second is one cue rather than four.
    advance(1_000);
    advance(1_000);
    advance(1_000);
    advance(1_000);

    expect(played).toEqual(['tick.mp3', 'tick.mp3', 'tick.mp3', 'go.mp3']);
  });

  it('re-arms the cues when he asks for another thirty seconds', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    advance(27_000);
    advance(1_000);
    expect(played).toEqual(['tick.mp3', 'tick.mp3']);

    fireEvent.click(screen.getByRole('button', { name: '+30s' }));
    advance(29_000);
    advance(1_000);
    advance(1_000);
    advance(1_000);

    // Three more ticks and the tone, rather than a rest that runs out in silence.
    expect(played).toEqual([...Array<string>(5).fill('tick.mp3'), 'go.mp3']);
  });
});
