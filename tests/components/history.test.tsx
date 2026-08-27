import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryScreen } from '@/components/HistoryScreen';
import { DoneScreen } from '@/components/DoneScreen';
import { WorkoutPreview } from '@/components/WorkoutPreview';
import { loadHistory, pushHistory, saveActive } from '@/lib/storage';
import { generate } from '@/lib/generate';
import { ALL_EXERCISES } from '@/lib/data/ancillary';
import { COMBOS } from '@/lib/data/combos';
import { FULL_KIT, entry, req } from '../fixtures';
import type { HistoryEntry, Step, WorkStep, Workout } from '@/lib/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/history', useRouter: () => ({ push: vi.fn() }) }));

const step: Step = {
  kind: 'work', exerciseId: 'two-hand-swing', name: 'Two-hand Swing', bellKg: 24, reps: 15,
  block: 'Main', round: 1, totalRounds: 3, indexInRound: 1, itemsInRound: 3, estSeconds: 30,
};

const workout = { steps: [step], format: 'circuit', estimatedSeconds: 1800 } as unknown as Workout;

beforeEach(() => localStorage.clear());

describe('HistoryScreen', () => {
  it('says so when nothing has been done yet', () => {
    render(<HistoryScreen />);
    expect(screen.getByText(/no workouts yet/i)).toBeDefined();
  });

  it('lists the newest session first', () => {
    pushHistory(entry({ id: 'old', createdAt: '2026-08-01T09:00:00.000Z', workout }));
    pushHistory(entry({ id: 'new', createdAt: '2026-08-25T09:00:00.000Z', workout }));
    render(<HistoryScreen />);
    const dates = screen.getAllByText(/Aug/).map((n) => n.textContent);
    expect(dates[0]).toMatch(/25 Aug/);
  });

  it('shows the date, the format, the duration and the rating on the row', () => {
    pushHistory(entry({ id: 'a', workedSeconds: 2040, felt: 'brutal', workout }));
    render(<HistoryScreen />);
    screen.getByText(/25 Aug/);
    screen.getByText(/Circuit · 34 min/);
    screen.getByText('Brutal');
  });

  it('tags the patterns it trained', () => {
    pushHistory(entry({ id: 'a', mainExerciseIds: ['two-hand-swing'], workout }));
    render(<HistoryScreen />);
    screen.getByText('Hinge');
  });

  it('opens on tap into the moves themselves', () => {
    pushHistory(entry({ id: 'a', workout }));
    render(<HistoryScreen />);
    const row = document.querySelector('details') as HTMLDetailsElement;
    expect(row.open).toBe(false);
    fireEvent.click(screen.getByText(/25 Aug/));
    screen.getByText('Two-hand Swing');
    expect(screen.getByText(/15 reps/).textContent).toMatch(/24 kg/);
  });

  /**
   * His record, his call - but it is the one irreversible act in the app, and
   * the runner is built the other way round: nothing there may delete a session
   * that happened. So it costs three taps, not one, and none of them is a tap
   * he could make by accident on the way to opening a row.
   */
  describe('deleting sessions', () => {
    const two = (): void => {
      pushHistory(entry({ id: 'old', createdAt: '2026-08-01T09:00:00.000Z', workout }));
      pushHistory(entry({ id: 'new', createdAt: '2026-08-25T09:00:00.000Z', workout }));
    };

    it('offers no ticks and no delete until he asks to select', () => {
      two();
      render(<HistoryScreen />);
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
      expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
      screen.getByRole('button', { name: 'Select' });
    });

    it('will not arm the delete until something is actually picked', () => {
      two();
      render(<HistoryScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      expect(screen.getAllByRole('checkbox')).toHaveLength(2);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    });

    /**
     * The tick must not also open the row. A control inside a <summary> does
     * both, which is why it sits outside one.
     */
    it('ticks a row without expanding it', () => {
      two();
      render(<HistoryScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      expect(document.querySelectorAll('details[open]')).toHaveLength(0);
    });

    it('asks once more, saying how many and that there is no undo', () => {
      two();
      render(<HistoryScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Delete 1 workout' }));

      screen.getByText('Delete 1 workout?');
      screen.getByText(/no undo/i);
      screen.getByRole('button', { name: 'Keep them' });
    });

    it('backs out of the confirmation with everything still ticked', () => {
      two();
      render(<HistoryScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Delete 1 workout' }));
      fireEvent.click(screen.getByRole('button', { name: 'Keep them' }));

      expect(loadHistory()).toHaveLength(2);
      expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
    });

    it('removes only what was picked, and writes that through to storage', () => {
      two();
      render(<HistoryScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      // Newest first, so the first tick is the 25 August session.
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Delete 1 workout' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete 1 workout' }));

      expect(loadHistory().map((e) => e.id)).toEqual(['old']);
      expect(screen.queryByText(/25 Aug/)).toBeNull();
      screen.getByText(/1 Aug/);
    });

    it('drops back out of selection once the deletion has happened', () => {
      two();
      render(<HistoryScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Delete 1 workout' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete 1 workout' }));

      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
      screen.getByRole('button', { name: 'Select' });
    });

    it('counts more than one in words that match the number', () => {
      two();
      render(<HistoryScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
      fireEvent.click(screen.getByRole('button', { name: 'Delete 2 workouts' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete 2 workouts' }));

      expect(loadHistory()).toHaveLength(0);
      screen.getByText(/no workouts yet/i);
    });
  });

  it('says nothing was recorded rather than showing an empty panel', () => {
    pushHistory(entry({ id: 'a' }));
    render(<HistoryScreen />);
    expect(screen.getByText(/no moves were recorded/i)).toBeDefined();
  });
});

/**
 * The two screens that describe a finished session must describe the SAME one.
 *
 * They read it from different places - Done lists the moves the runner recorded
 * as performed, History renders the stored steps - so nothing but a test keeps
 * them saying the same thing. Before the Main-block filter went in, History
 * opened on twenty-six lines of warm-up and cool-down against Done's six moves,
 * and there was no way to tell from the app which was the truth.
 */
describe('Done and History describe the same session', () => {
  const build = () => generate({
    request: req({ capability: 'intermediate', patterns: ['hinge', 'squat', 'push'] }),
    kit: FULL_KIT, exercises: ALL_EXERCISES, combos: COMBOS, history: [],
    now: '2026-08-25T09:00:00.000Z',
  });

  /** What the runner writes: the distinct Main-block moves actually performed. */
  const performed = (w: Workout): string[] => [...new Set(
    w.steps.filter((s): s is WorkStep => s.kind === 'work' && s.block === 'Main').map((s) => s.exerciseId),
  )];

  const finished = (w: Workout): HistoryEntry =>
    entry({ id: 'done', workout: w, mainExerciseIds: performed(w), workedSeconds: 2040 });

  /** "Half-Kneeling Press (left)" and the right-hand side are one move. */
  const withoutSides = (names: string[]): string[] =>
    [...new Set(names.map((n) => n.replace(/ \((left|right)\)$/, '')))].sort();

  it('lists the same moves on both screens, and only the moves he did', () => {
    const w = build();
    pushHistory(finished(w));

    const done = render(<DoneScreen />);
    const doneMoves = [...done.container.querySelectorAll('li')].map((li) => li.textContent ?? '');
    done.unmount();

    render(<HistoryScreen />);
    fireEvent.click(screen.getByText(/25 Aug/));
    const rowMoves = [...document.querySelectorAll('details li')]
      .map((li) => li.querySelector('span')?.textContent ?? '');

    expect(rowMoves.length).toBeGreaterThan(0);
    expect(withoutSides(rowMoves)).toEqual(withoutSides(doneMoves));
  });

  it('keeps the warm-up and the cool-down out of the expanded row', () => {
    const w = build();
    pushHistory(finished(w));
    render(<HistoryScreen />);
    fireEvent.click(screen.getByText(/25 Aug/));

    const ancillary = w.steps
      .filter((s): s is WorkStep => s.kind === 'work' && s.block !== 'Main')
      .map((s) => s.name);
    const shown = [...document.querySelectorAll('details li')].map((li) => li.textContent ?? '');

    expect(ancillary.length).toBeGreaterThan(0);
    for (const name of ancillary) expect(shown.some((line) => line.includes(name))).toBe(false);
  });

  it('shows only what he got through when the session ended early', () => {
    const w = build();
    const all = performed(w);
    pushHistory(entry({ id: 'part', workout: w, mainExerciseIds: all.slice(0, 1) }));
    render(<HistoryScreen />);
    fireEvent.click(screen.getByText(/25 Aug/));
    const shown = [...document.querySelectorAll('details li')];
    expect(shown.length).toBeGreaterThan(0);
    expect(withoutSides(shown.map((li) => li.querySelector('span')?.textContent ?? ''))).toHaveLength(1);
  });

  it('gives the row a visible way of saying it opens', () => {
    pushHistory(entry({ id: 'a', workout }));
    render(<HistoryScreen />);
    const marker = document.querySelector('summary svg');
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute('class')).toContain('group-open:-rotate-180');
  });
});

/**
 * Preview and History are the before and after of one session, and they were
 * counting it differently: Preview said "5 rounds", History rendered a single
 * round with no count at all, so a thirty-minute workout read afterwards as
 * eight moves and about thirty reps. Both now take the words from the same
 * function, which is the only thing that keeps two screens agreeing.
 */
describe('Preview and History describe the same session the same way', () => {
  const build = () => generate({
    request: req({ capability: 'intermediate', patterns: ['hinge', 'squat', 'push'], totalMinutes: 30 }),
    kit: FULL_KIT, exercises: ALL_EXERCISES, combos: COMBOS, history: [],
    now: '2026-08-25T09:00:00.000Z',
  });

  /** The rounds line beside a block heading, on either screen. */
  const roundsBeside = (heading: string): string => {
    const h = [...document.querySelectorAll('h2, h3')].find((n) => n.textContent === heading);
    return h?.parentElement?.querySelector('span, p')?.textContent?.trim() ?? '';
  };

  it('agrees on how many times round he went', () => {
    const w = build();
    const mainSteps = w.steps.filter((s): s is WorkStep => s.kind === 'work' && s.block === 'Main');
    const rounds = mainSteps[0].totalRounds;

    saveActive({ v: 1, workout: w, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null });
    const preview = render(<WorkoutPreview />);
    const onPreview = roundsBeside('Main');
    preview.unmount();

    pushHistory(entry({
      id: 'a', workout: w, workedSeconds: 1800,
      mainExerciseIds: [...new Set(mainSteps.map((s) => s.exerciseId))],
    }));
    render(<HistoryScreen />);
    fireEvent.click(screen.getByText(/25 Aug/));
    const onHistory = roundsBeside('Main');

    expect(onPreview).toBe(onHistory);
    expect(onHistory).toBe(rounds > 1 ? `${rounds} rounds` : 'once through');
  });

  it('does not leave a history row reading as one pass of a multi-round session', () => {
    const w = build();
    const mainSteps = w.steps.filter((s): s is WorkStep => s.kind === 'work' && s.block === 'Main');
    expect(mainSteps[0].totalRounds).toBeGreaterThan(1);

    pushHistory(entry({ id: 'a', workout: w, mainExerciseIds: [...new Set(mainSteps.map((s) => s.exerciseId))] }));
    render(<HistoryScreen />);
    fireEvent.click(screen.getByText(/25 Aug/));
    expect(screen.getByText(new RegExp(`${mainSteps[0].totalRounds} rounds`))).toBeDefined();
  });
});
