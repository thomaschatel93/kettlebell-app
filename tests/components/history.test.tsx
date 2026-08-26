import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryScreen } from '@/components/HistoryScreen';
import { pushHistory } from '@/lib/storage';
import { entry } from '../fixtures';
import type { Step, Workout } from '@/lib/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/history' }));

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

  it('says nothing was recorded rather than showing an empty panel', () => {
    pushHistory(entry({ id: 'a' }));
    render(<HistoryScreen />);
    expect(screen.getByText(/no moves were recorded/i)).toBeDefined();
  });
});
