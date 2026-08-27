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
/** A cool-down move. It gets the same full card as anything in the main block. */
const cool = (name: string): Step =>
  work(name, { block: 'Cool-down', bellKg: null, reps: undefined, seconds: 30, totalRounds: 1 });

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
    screen.getByText(/Round 1 of 2/);
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

  /**
   * Warm-up and cool-down are full cards now, the same as the main block.
   *
   * They used to be one scrolling checklist per block, on the reasoning that
   * hip circles do not each need a screen. Real use said otherwise: the block
   * where he is coldest and least willing to think was the one block the app
   * would not hold his place in. The no-image path the main card already had -
   * media slot collapsed, execution cues promoted - is what makes this work
   * before any of the fourteen ancillary stills exist.
   */
  it('gives a cool-down move its own card, not a checklist', () => {
    seed([work('Swing'), cool('Hamstring Stretch')]);
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    screen.getByRole('heading', { name: 'Hamstring Stretch' });
    expect(screen.queryByRole('checkbox')).toBeNull();
    screen.getByText(/Cool-down/);
  });

  /**
   * The last screen of every session. Routing it to a Next that no-ops on the
   * final step made it dead exactly there: he taps the obvious control at the
   * end of the workout and the app ignores him.
   */
  it('finishes the session from the last card', () => {
    seed([work('Swing'), cool('Hamstring Stretch')]);
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(loadHistory()).toHaveLength(1);
    expect(loadActive()).toBeNull();
    expect(push).toHaveBeenCalledWith('/workout/done');
  });

  /**
   * A warm-up of four moves is four screens, one tap apart, and Previous still
   * works on every one of them. The checklist grouped a whole block behind one
   * index, so stepping back out of the main block landed on the top of the
   * warm-up rather than on the move he had just done.
   */
  it('walks warm-up moves one at a time, forwards and back', () => {
    const warm = (name: string): Step =>
      work(name, { block: 'Warm-up', bellKg: null, reps: undefined, seconds: 30, totalRounds: 1, itemsInRound: 2 });
    seed([warm('Hip Circles'), warm('Leg Swings'), work('Swing')]);
    render(<WorkoutRunner />);

    screen.getByRole('heading', { name: 'Hip Circles' });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    screen.getByRole('heading', { name: 'Leg Swings' });
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    screen.getByRole('heading', { name: 'Hip Circles' });
    expect(loadActive()!.stepIndex).toBe(0);
  });

  /**
   * The plan carries fifteen seconds between one warm-up move and the next.
   * Those are not rests, they are the seconds allowed for walking to the mat -
   * and a countdown he has to stand through seven times is the opposite of a
   * warm-up. They keep their place in the estimate and get no screen.
   */
  it('walks past the transition seconds inside a warm-up', () => {
    const warm = (name: string): Step =>
      work(name, { block: 'Warm-up', bellKg: null, reps: undefined, seconds: 30, totalRounds: 1, itemsInRound: 2 });
    seed([
      warm('Hip Circles'),
      { kind: 'rest', seconds: 15, nextName: 'Leg Swings', block: 'Warm-up', estSeconds: 15 },
      warm('Leg Swings'),
    ]);
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    screen.getByRole('heading', { name: 'Leg Swings' });
    expect(screen.queryByRole('heading', { name: 'Rest' })).toBeNull();
    expect(loadActive()!.stepIndex).toBe(2);
  });

  /** A rest in the main block is a real rest and still gets its own screen. */
  it('still stops on a rest in the main block', () => {
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    screen.getByRole('heading', { name: 'Rest' });
  });

  /**
   * Pause looked like a control that did nothing, because on a work step there
   * was no moving number for it to stop. The clock was running the whole time
   * and shown nowhere.
   */
  it('shows the worked clock and freezes it while paused', () => {
    render(<WorkoutRunner />);
    act(() => { vi.advanceTimersByTime(65_000); });
    screen.getByText('1:05');

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => { vi.advanceTimersByTime(30_000); });
    screen.getByText('Paused');
    screen.getByText('1:05');
  });

  /** The same dead shape, which is why the fix is in one place rather than two. */
  it('finishes the session when Skip rest is the last thing left', () => {
    seed([work('Swing'), rest(30, 'nothing')]);
    render(<WorkoutRunner />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(screen.getByRole('button', { name: 'Skip rest' }));
    expect(loadHistory()).toHaveLength(1);
    expect(loadActive()).toBeNull();
    expect(push).toHaveBeenCalledWith('/workout/done');
  });

  /**
   * A rest belongs to what comes next. The card already says "Next: <a round
   * two move>", so a header reading "Round 1 of 4" beside it reads as a bug.
   */
  it('names the round the rest is leading into, not the one just finished', () => {
    seed([
      work('Swing', { round: 1, totalRounds: 4 }),
      rest(30, 'Swing'),
      work('Swing', { round: 2, totalRounds: 4 }),
    ]);
    render(<WorkoutRunner />);
    screen.getByText(/Round 1 of 4/);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    screen.getByRole('heading', { name: 'Rest' });
    screen.getByText(/Round 2 of 4/);
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

  /**
   * The cue files are normalised to a fixed peak by `npm run audio`, and this
   * is the one line in the app that could quietly undo that work. It used to:
   * both elements were held 1.9 dB down by a hard-coded 0.8 that nothing
   * anywhere explained. The phone already has a volume control.
   */
  it('plays the cues at full scale, so the generated level is the level', async () => {
    const volume = vi.spyOn(HTMLMediaElement.prototype, 'volume', 'set');
    render(<WorkoutRunner />);
    await act(async () => {});
    expect(volume).toHaveBeenCalled();
    for (const [v] of volume.mock.calls) expect(v).toBe(1);
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
