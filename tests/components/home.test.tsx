import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeScreen } from '@/components/HomeScreen';
import { pushHistory, saveKits, loadKits, saveActive, loadActive, loadHistory } from '@/lib/storage';
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
    screen.getByRole('img', { name: /Minutes this week: 50/ });
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

/**
 * The other end of the same hole. Resume rightly stops offering a session left
 * more than three hours, but nothing used to turn it into a record, so the work
 * aged quietly out of existence. It is his call now, and both answers do
 * something.
 */
describe('HomeScreen and a session left too long', () => {
  const stale = (workedSeconds = 300) =>
    saveActive({ ...active(new Date(Date.now() - 5 * 3600e3).toISOString()), workedSeconds });

  it('offers to keep it rather than letting it rot', () => {
    stale();
    render(<HomeScreen />);
    expect(screen.getByText(/unfinished session/i)).toBeDefined();
    screen.getByRole('button', { name: /save it to my history/i });
  });

  it('files it, with the work on it, when he says so', () => {
    stale();
    render(<HomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: /save it to my history/i }));
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].workedSeconds).toBe(300);
    expect(loadActive()).toBeNull();
  });

  it('throws it away only when he chooses to, and then really does', () => {
    stale();
    render(<HomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: /throw it away/i }));
    expect(loadHistory()).toHaveLength(0);
    expect(loadActive()).toBeNull();
  });

  it('says nothing about a stale workout he never started', () => {
    saveActive({ ...active(new Date(Date.now() - 5 * 3600e3).toISOString()), stepIndex: 0, workedSeconds: 0 });
    render(<HomeScreen />);
    expect(screen.queryByText(/unfinished session/i)).toBeNull();
  });

  it('offers nothing of the sort while the session is still resumable', () => {
    saveActive(active(new Date().toISOString()));
    render(<HomeScreen />);
    expect(screen.queryByText(/unfinished session/i)).toBeNull();
    screen.getByRole('link', { name: /resume/i });
  });
});
