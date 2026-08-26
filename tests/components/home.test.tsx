import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeScreen } from '@/components/HomeScreen';
import { pushHistory, saveKits, loadKits, saveActive } from '@/lib/storage';
import { entry, req } from '../fixtures';
import type { Step, Workout } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }));

/**
 * A workout the storage layer will actually give back. `loadActive` rejects a
 * stepIndex that is out of range, so a resume test built on an empty `steps`
 * array tests nothing: the stored value never survives the read.
 */
const step = (name: string): Step => ({
  kind: 'work', exerciseId: 'f-swing', name, bellKg: 16, reps: 10,
  block: 'Main', round: 1, totalRounds: 1, indexInRound: 1, itemsInRound: 3, estSeconds: 30,
});

const workoutAt = (createdAt: string): Workout => ({
  id: 'w', createdAt, request: req(), format: 'circuit',
  steps: [step('A'), step('B'), step('C')],
  estimatedSeconds: 0, loadWarning: false, shortOfBudget: false,
});

const active = (createdAt: string) => ({
  v: 1 as const, workout: workoutAt(createdAt), stepIndex: 2,
  workedSeconds: 60, restEndsAt: null, pausedRemainingMs: null,
});

beforeEach(() => localStorage.clear());

describe('HomeScreen', () => {
  it('invites a first workout when there is no history', () => {
    render(<HomeScreen />);
    expect(screen.getByText(/no workouts yet/i)).toBeDefined();
  });

  it('counts this week and the minutes', () => {
    pushHistory(entry({ id: 'a', createdAt: new Date().toISOString() }));
    pushHistory(entry({ id: 'b', createdAt: new Date().toISOString() }));
    render(<HomeScreen />);
    screen.getByRole('img', { name: /Workouts this week: 2/ });
    screen.getByRole('img', { name: /Minutes: 50/ });
  });

  it('ignores workouts older than seven days in the weekly count', () => {
    pushHistory(entry({ id: 'old', createdAt: new Date(Date.now() - 10 * 864e5).toISOString() }));
    render(<HomeScreen />);
    screen.getByRole('img', { name: /Workouts this week: 0/ });
  });

  it('still counts an older workout in the all-time total', () => {
    pushHistory(entry({ id: 'old', createdAt: new Date(Date.now() - 10 * 864e5).toISOString() }));
    render(<HomeScreen />);
    expect(screen.getByText(/all time/i).textContent).toMatch(/1 workout/);
  });

  it('shows seven dots for the last week rather than a streak', () => {
    render(<HomeScreen />);
    expect(screen.getAllByTestId('week-dot')).toHaveLength(7);
    expect(screen.queryByText(/streak/i)).toBeNull();
  });

  it('fills a dot for a day he trained and leaves the rest empty', () => {
    pushHistory(entry({ id: 'a', createdAt: new Date().toISOString() }));
    render(<HomeScreen />);
    const filled = screen.getAllByTestId('week-dot').filter((d) => d.dataset.trained === 'true');
    expect(filled).toHaveLength(1);
  });

  it('names the active kit', () => {
    const s = loadKits(); s.activeId = 'gym'; saveKits(s);
    render(<HomeScreen />);
    screen.getByText('Gym');
  });

  it('offers to resume a recent workout', () => {
    saveActive(active(new Date().toISOString()));
    render(<HomeScreen />);
    screen.getByRole('link', { name: /resume/i });
  });

  it('does not offer to resume a workout from days ago', () => {
    saveActive(active(new Date(Date.now() - 4 * 864e5).toISOString()));
    render(<HomeScreen />);
    expect(screen.queryByRole('link', { name: /resume/i })).toBeNull();
  });

  it('drops the offer the moment the workout passes three hours', () => {
    saveActive(active(new Date(Date.now() - 3 * 3600e3 - 1000).toISOString()));
    render(<HomeScreen />);
    expect(screen.queryByRole('link', { name: /resume/i })).toBeNull();
  });

  it('keeps the offer just inside three hours', () => {
    saveActive(active(new Date(Date.now() - 2 * 3600e3).toISOString()));
    render(<HomeScreen />);
    screen.getByRole('link', { name: /resume/i });
  });

  /**
   * An unreadable timestamp is not evidence the workout is stale. Discarding a
   * session in progress on the strength of a date we failed to parse is the
   * worse of the two mistakes, and the run screen re-validates the state anyway.
   */
  it('still offers to resume when the timestamp cannot be read', () => {
    saveActive(active('not a date'));
    render(<HomeScreen />);
    screen.getByRole('link', { name: /resume/i });
  });

  it('always offers a way to start a workout', () => {
    render(<HomeScreen />);
    screen.getByRole('link', { name: /start a workout/i });
  });
});
