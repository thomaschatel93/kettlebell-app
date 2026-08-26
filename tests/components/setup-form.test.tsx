import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetupForm } from '@/components/SetupForm';
import { loadPrefs, loadKits, saveKits, loadActive } from '@/lib/storage';

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
