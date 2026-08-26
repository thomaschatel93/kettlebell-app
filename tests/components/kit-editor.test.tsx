import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { KitEditor } from '@/components/KitEditor';
import { loadKits, saveKits, KITS_KEY } from '@/lib/storage';
import { publishKit } from '@/lib/kit-store';

beforeEach(() => localStorage.clear());

describe('KitEditor', () => {
  it('shows exactly two profiles and no way to add or delete one', () => {
    render(<KitEditor />);
    screen.getByRole('button', { name: /Home/ });
    screen.getByRole('button', { name: /Gym/ });
    expect(screen.queryByRole('button', { name: /add profile/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete profile/i })).toBeNull();
  });

  it('adds a bell from a weight chip and persists it', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a 24 kg bell' }));
    screen.getByText('24 kg × 1');
    expect(loadKits().profiles.find((p) => p.id === 'home')!.bells).toEqual([{ weightKg: 24, count: 1 }]);
  });

  it('increments the count rather than duplicating the row', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a 16 kg bell' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a 16 kg bell' }));
    expect(loadKits().profiles.find((p) => p.id === 'home')!.bells).toEqual([{ weightKg: 16, count: 2 }]);
    screen.getByText('16 kg × 2');
  });

  it('removes a bell', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a 16 kg bell' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove a 16 kg bell' }));
    expect(loadKits().profiles.find((p) => p.id === 'home')!.bells).toEqual([]);
  });

  it('switches the active profile and edits that one', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Gym/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a 32 kg bell' }));
    expect(loadKits().activeId).toBe('gym');
    expect(loadKits().profiles.find((p) => p.id === 'gym')!.bells).toEqual([{ weightKg: 32, count: 1 }]);
    expect(loadKits().profiles.find((p) => p.id === 'home')!.bells).toEqual([]);
  });

  it('toggles the bench for the active profile', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('switch', { name: /bench/i }));
    expect(loadKits().profiles.find((p) => p.id === 'home')!.hasBench).toBe(true);
  });

  it('warns when the kit cannot separate the load bands', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a 24 kg bell' }));
    expect(screen.getByRole('status').textContent).toMatch(/one bell|three different/i);
  });

  /*
   * The OFF state. A warning that never goes away is a warning the user learns
   * to ignore, which is the same failure as not warning at all - and this one
   * is load-bearing: prescribe() cuts the reps whenever it is true.
   */
  it('takes the warning away once three distinct weights can separate the bands', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a 16 kg bell' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a 24 kg bell' }));
    expect(screen.getByRole('status').textContent).toMatch(/three different/i);

    fireEvent.click(screen.getByRole('button', { name: 'Add a 32 kg bell' }));
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('warns again if the third weight is taken back off', () => {
    render(<KitEditor />);
    for (const w of [16, 24, 32]) fireEvent.click(screen.getByRole('button', { name: `Add a ${w} kg bell` }));
    expect(screen.getByRole('status').textContent).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Remove a 32 kg bell' }));
    expect(screen.getByRole('status').textContent).toMatch(/three different/i);
  });

  /*
   * A pair of the same bell is two bells but one weight, so the bands still
   * collapse. Counting rows rather than distinct weights would silence the
   * warning here, which is the exact case it exists for.
   */
  it('counts distinct weights, not bells, when deciding whether to warn', () => {
    render(<KitEditor />);
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Add a 24 kg bell' }));
    expect(screen.getByText('24 kg × 3')).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toMatch(/three different/i);
  });

  /*
   * The kit is one shared store, not a copy per screen. A write from anywhere
   * else - another screen, another tab - has to reach a mounted Kit tab, or
   * four screens end up disagreeing about which bells the user owns.
   */
  it('picks up a kit written from outside the component', () => {
    render(<KitEditor />);
    expect(screen.queryByText('20 kg × 1')).toBeNull();

    const state = loadKits();
    state.profiles[0].bells = [{ weightKg: 20, count: 1 }];
    act(() => publishKit(state));

    screen.getByText('20 kg × 1');
  });

  it('picks up a kit written by another tab, through the storage event', () => {
    render(<KitEditor />);

    const state = loadKits();
    state.profiles[0].bells = [{ weightKg: 28, count: 2 }];
    saveKits(state);                                   // as another tab would
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KITS_KEY }));
    });

    screen.getByText('28 kg × 2');
  });

  /*
   * White on --accent is 3.32:1 and legal only as large bold text. Every filled
   * control here carries a small subtitle, so it must take --fill-ink. This
   * pins the Kit screen's half of the rule; tokens.test.ts pins the token pair
   * and primitives.test.tsx pins Chip's half.
   */
  it('inks its filled controls with --fill-ink, never the large-text-only --accent-ink', () => {
    render(<KitEditor />);
    const home = screen.getByRole('button', { name: /Home/ });
    expect(home.getAttribute('style')).toContain('var(--fill-ink)');
    expect(home.getAttribute('style')).not.toContain('--accent-ink');
    expect(home.getAttribute('style')).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it('offers the capability options as one exclusive radiogroup', () => {
    render(<KitEditor />);
    const group = screen.getByRole('radiogroup', { name: /what you can do/i });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);

    const advanced = screen.getByRole('radio', { name: /I can snatch and get up/i });
    const starting = screen.getByRole('radio', { name: /I’m starting out/i });
    expect(starting).toBeChecked();

    fireEvent.click(advanced);
    expect(advanced).toBeChecked();
    expect(starting).not.toBeChecked();
  });

  // The brief wrote this as getByRole('button'). The three options are mutually
  // exclusive, so they are radios in a radiogroup instead - see the fix report.
  it('sets capability, which is stored not asked every session', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('radio', { name: /I can snatch and get up/i }));
    expect(loadKits().capability).toBe('advanced');
  });
});
