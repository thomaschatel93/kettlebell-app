import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KitEditor } from '@/components/KitEditor';
import { loadKits } from '@/lib/storage';

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

  it('sets capability, which is stored not asked every session', () => {
    render(<KitEditor />);
    fireEvent.click(screen.getByRole('button', { name: /I can snatch and get up/i }));
    expect(loadKits().capability).toBe('advanced');
  });
});
