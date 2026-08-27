import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkoutPreview } from '@/components/WorkoutPreview';
import { saveActive } from '@/lib/storage';
import { generate } from '@/lib/generate';
import { ALL_EXERCISES } from '@/lib/data/ancillary';
import { COMBOS } from '@/lib/data/combos';
import { FULL_KIT, HOME_KIT, req } from '../fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const build = (kit = FULL_KIT) => generate({
  request: req({ capability: 'advanced', patterns: ['hinge', 'squat', 'push'] }),
  kit, exercises: ALL_EXERCISES, combos: COMBOS, history: [], now: '2026-08-25T09:00:00.000Z',
});

beforeEach(() => localStorage.clear());

describe('WorkoutPreview', () => {
  it('leads with the bells to fetch', () => {
    const w = build();
    saveActive({ v: 1, workout: w, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null });
    render(<WorkoutPreview />);
    expect(screen.getByText(/You'll need/).textContent).toMatch(/kg/);
  });

  it('states the real estimate against the request', () => {
    const w = build();
    saveActive({ v: 1, workout: w, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null });
    render(<WorkoutPreview />);
    screen.getByText(new RegExp(`about ${Math.round(w.estimatedSeconds / 60)} min`, 'i'));
  });

  it('warns when the kit cannot separate the load bands', () => {
    const w = build(HOME_KIT);
    saveActive({ v: 1, workout: w, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null });
    render(<WorkoutPreview />);
    expect(screen.getByRole('status').textContent).toMatch(/not scaled|cut the press/i);
  });
});

describe('a reroll that cannot be saved', () => {
  afterEach(() => vi.restoreAllMocks());

  /**
   * The run screen reads the workout back OUT of storage. A reroll whose write
   * failed on quota or in a private window used to report the change as though
   * it had landed, leaving him to tap Start into a runner holding a workout he
   * had already been told was replaced.
   */
  it('says so rather than reporting a change that did not happen', () => {
    const w = build();
    saveActive({ v: 1, workout: w, stepIndex: 0, workedSeconds: 0, restEndsAt: null, pausedRemainingMs: null });
    render(<WorkoutPreview />);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    fireEvent.click(screen.getByRole('button', { name: /build a different one/i }));

    expect(screen.getByRole('status').textContent).toMatch(/could not be saved/i);
  });
});
