import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetupForm } from '@/components/SetupForm';
import { loadPrefs, loadKits, saveKits, loadActive, loadHistory, saveActive } from '@/lib/storage';
import { req } from '../fixtures';
import type { Step, Workout } from '@/lib/types';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const withBells = () => {
  const s = loadKits();
  s.profiles[0].bells = [{ weightKg: 16, count: 2 }, { weightKg: 24, count: 1 }, { weightKg: 32, count: 1 }];
  s.capability = 'advanced';
  saveKits(s);
};

beforeEach(() => { localStorage.clear(); push.mockClear(); withBells(); });

describe('SetupForm', () => {
  it('offers all six patterns with their body parts', () => {
    render(<SetupForm />);
    for (const p of ['Hinge', 'Squat', 'Push', 'Pull', 'Carry', 'Core']) screen.getByRole('button', { name: new RegExp(p) });
    screen.getByText(/shoulders, chest, triceps/);
  });

  it('offers a full body preset that ticks four patterns at once', () => {
    render(<SetupForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Full body' }));
    for (const p of ['Hinge', 'Squat', 'Push', 'Pull']) {
      expect(screen.getByRole('button', { name: new RegExp(p) })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('asks about effort today, not about capability', () => {
    render(<SetupForm />);
    for (const e of ['Easy', 'Normal', 'Hard']) screen.getByRole('button', { name: e });
    expect(screen.queryByRole('button', { name: /starting out/i })).toBeNull();
  });

  it('will not generate with no pattern selected', () => {
    render(<SetupForm />);
    for (const p of ['Hinge', 'Squat', 'Push']) fireEvent.click(screen.getByRole('button', { name: new RegExp(p) }));
    expect(screen.getByRole('button', { name: 'Generate workout' })).toBeDisabled();
  });

  it('warns when the active kit has no bells', () => {
    const s = loadKits(); s.profiles[0].bells = []; saveKits(s);
    render(<SetupForm />);
    expect(screen.getByRole('alert').textContent).toMatch(/add a bell/i);
  });

  it('warns when the pool cannot train a requested pattern', () => {
    const s = loadKits(); s.profiles[0].bells = [{ weightKg: 16, count: 1 }]; saveKits(s);
    render(<SetupForm />);
    fireEvent.click(screen.getByRole('button', { name: /Carry/ }));
    expect(screen.getByRole('status').textContent).toMatch(/carry/i);
  });

  it('saves the choices, stores the workout and moves to the preview', () => {
    render(<SetupForm />);
    fireEvent.click(screen.getByRole('button', { name: /Pull/ }));
    fireEvent.click(screen.getByRole('button', { name: '45 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate workout' }));

    expect(loadPrefs().totalMinutes).toBe(45);
    expect(loadPrefs().patterns).toContain('pull');
    expect(loadActive()?.stepIndex).toBe(0);
    expect(push).toHaveBeenCalledWith('/workout/preview');
  });
});

/**
 * The hole this closes: "Resume workout" is a grey ghost on Home and "Start a
 * workout" is the big orange one directly beneath it. Tapping the loud one led
 * here, and Generate wrote straight over `kb.active.v1` - no warning, no
 * record, the work simply gone. The spec's own rule is that nothing in this app
 * deletes a session that happened.
 */
describe('SetupForm with a workout already in progress', () => {
  const step = (name: string): Step => ({
    kind: 'work', exerciseId: 'two-hand-swing', name, bellKg: 16, reps: 10,
    block: 'Main', round: 1, totalRounds: 3, indexInRound: 1, itemsInRound: 3, estSeconds: 30,
  });

  const live = (workedSeconds = 300) => {
    const workout: Workout = {
      id: 'w', createdAt: new Date().toISOString(), request: req(), format: 'circuit',
      steps: [step('A'), step('B'), step('C')], estimatedSeconds: 900,
      loadWarning: false, shortOfBudget: false,
    };
    saveActive({ v: 1, workout, stepIndex: 2, workedSeconds, restEndsAt: null, pausedRemainingMs: null });
  };

  it('says what generating will do to it, above the button that does it', () => {
    live();
    render(<SetupForm />);
    expect(screen.getByRole('status').textContent).toMatch(/still in progress/i);
    screen.getByRole('link', { name: /resume it instead/i });
  });

  it('files the session rather than overwriting it', () => {
    live();
    render(<SetupForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate workout' }));

    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].workedSeconds).toBe(300);
    // And the slot now holds the NEW workout, not the old one.
    expect(loadActive()?.workout.id).not.toBe('w');
    expect(push).toHaveBeenCalledWith('/workout/preview');
  });

  it('says nothing, and writes nothing, for a workout that was never started', () => {
    live(0);
    saveActive({ ...loadActive()!, stepIndex: 0, workedSeconds: 0 });
    render(<SetupForm />);
    expect(screen.getByRole('status').textContent).not.toMatch(/still in progress/i);
    fireEvent.click(screen.getByRole('button', { name: 'Generate workout' }));
    expect(loadHistory()).toHaveLength(0);
  });
});
