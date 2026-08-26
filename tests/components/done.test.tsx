import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DoneScreen } from '@/components/DoneScreen';
import { pushHistory, loadHistory } from '@/lib/storage';
import { entry } from '../fixtures';
import type { Workout } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/workout/done' }));

/**
 * `steps` is not decoration here: `loadHistory` drops an entry whose workout has
 * no steps array, so an entry written without one is never read back at all.
 */
const workout = (over: Partial<Workout> = {}) => ({ steps: [], ...over }) as Workout;

beforeEach(() => localStorage.clear());

describe('DoneScreen', () => {
  it('compares the worked time against the estimate', () => {
    pushHistory(entry({ workedSeconds: 2040, workout: workout({ estimatedSeconds: 1800 }) }));
    render(<DoneScreen />);
    screen.getByText(/34 min/);
    screen.getByText(/30 min/);
  });

  /**
   * The estimate line is the only thing in the app that would ever surface a
   * wrong secondsPerRep in the database, so it has to appear even - especially -
   * when the two numbers are far apart.
   */
  it('says so when the session ran well over the estimate', () => {
    pushHistory(entry({ workedSeconds: 3600, workout: workout({ estimatedSeconds: 1800 }) }));
    render(<DoneScreen />);
    expect(screen.getByText(/estimated 30 min/)).toBeDefined();
  });

  it('leaves the comparison out when there is no estimate to compare against', () => {
    pushHistory(entry({ workedSeconds: 600, workout: workout({ estimatedSeconds: 0 }) }));
    render(<DoneScreen />);
    expect(screen.queryByText(/estimated/i)).toBeNull();
  });

  it('records a one-tap effort rating', () => {
    pushHistory(entry({ id: 'x' }));
    render(<DoneScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Brutal' }));
    expect(loadHistory()[0].felt).toBe('brutal');
  });

  it('offers all three ratings and marks the one chosen', () => {
    pushHistory(entry({ id: 'x' }));
    render(<DoneScreen />);
    for (const name of ['Easy', 'Right', 'Brutal']) screen.getByRole('button', { name });
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    expect(screen.getByRole('button', { name: 'Right' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Easy' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('writes the rating onto the entry it is showing, not whichever is first', () => {
    pushHistory(entry({ id: 'older', createdAt: '2026-08-01T09:00:00.000Z' }));
    pushHistory(entry({ id: 'newest', createdAt: '2026-08-25T09:00:00.000Z' }));
    render(<DoneScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
    const stored = loadHistory();
    expect(stored.find((e) => e.id === 'newest')?.felt).toBe('easy');
    expect(stored.find((e) => e.id === 'older')?.felt).toBeUndefined();
  });

  it('says something honest when there is no session to show', () => {
    render(<DoneScreen />);
    expect(screen.getByText(/nothing to show/i)).toBeDefined();
  });
});
