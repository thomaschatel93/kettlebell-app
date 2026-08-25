import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadKits, saveKits, loadHistory, pushHistory, loadPrefs, savePrefs,
  loadActive, saveActive, clearActive,
} from '@/lib/storage';
import { entry, req } from './fixtures';
import type { Workout } from '@/lib/types';

const workout = { id: 'w', createdAt: 'now', request: req(), format: 'circuit',
  steps: [], estimatedSeconds: 0, loadWarning: false, shortOfBudget: false } as Workout;

beforeEach(() => localStorage.clear());

describe('kits', () => {
  it('returns two profiles and beginner capability when nothing is stored', () => {
    const s = loadKits();
    expect(s.profiles.map((p) => p.id)).toEqual(['home', 'gym']);
    expect(s.activeId).toBe('home');
    expect(s.capability).toBe('beginner');
  });

  it('round-trips what it saved', () => {
    const s = loadKits();
    s.profiles[0].bells = [{ weightKg: 20, count: 2 }];
    s.capability = 'advanced';
    saveKits(s);
    expect(loadKits().profiles[0].bells[0].weightKg).toBe(20);
    expect(loadKits().capability).toBe('advanced');
  });

  it('falls back to the defaults when the stored value is corrupt', () => {
    localStorage.setItem('kb.kits.v1', '{not json');
    expect(loadKits().profiles).toHaveLength(2);
  });

  it('discards a stored value from an older shape', () => {
    localStorage.setItem('kb.kits.v1', JSON.stringify({ v: 0, profiles: [], activeId: 'x' }));
    expect(loadKits().profiles).toHaveLength(2);
  });

  it('repairs an activeId that names no existing profile', () => {
    localStorage.setItem('kb.kits.v1', JSON.stringify({
      ...loadKits(), activeId: 'gone',
    }));
    expect(loadKits().activeId).toBe('home');
  });
});

describe('history', () => {
  it('starts empty', () => expect(loadHistory()).toEqual([]));

  it('puts the newest entry first', () => {
    pushHistory(entry({ id: 'one' }));
    pushHistory(entry({ id: 'two' }));
    expect(loadHistory().map((h) => h.id)).toEqual(['two', 'one']);
  });

  it('keeps only the last thirty', () => {
    for (let i = 0; i < 35; i++) pushHistory(entry({ id: `e${i}` }));
    expect(loadHistory()).toHaveLength(30);
    expect(loadHistory()[0].id).toBe('e34');
  });

  it('keeps the whole workout, not a summary', () => {
    pushHistory(entry({ id: 'w1', workout }));
    expect(loadHistory()[0].workout.format).toBe('circuit');
  });
});

describe('prefs', () => {
  it('defaults to a sensible first workout', () => {
    const p = loadPrefs();
    expect(p.totalMinutes).toBe(30);
    expect(p.effort).toBe('normal');
    expect(p.patterns.length).toBeGreaterThan(0);
  });

  it('round-trips', () => {
    savePrefs({ patterns: ['pull'], effort: 'hard', totalMinutes: 45 });
    expect(loadPrefs().effort).toBe('hard');
  });

  it('rejects a stored empty pattern list rather than disabling the app', () => {
    localStorage.setItem('kb.prefs.v1', JSON.stringify({ v: 1, patterns: [], effort: 'normal', totalMinutes: 30 }));
    expect(loadPrefs().patterns.length).toBeGreaterThan(0);
  });
});

describe('active workout', () => {
  it('is null when nothing is in progress', () => expect(loadActive()).toBeNull());

  it('round-trips and clears', () => {
    saveActive({ v: 1, workout, stepIndex: 3, workedSeconds: 120, restEndsAt: null, pausedRemainingMs: null });
    expect(loadActive()?.stepIndex).toBe(3);
    clearActive();
    expect(loadActive()).toBeNull();
  });

  it('keeps an absolute rest deadline, not a counter', () => {
    saveActive({ v: 1, workout, stepIndex: 1, workedSeconds: 0, restEndsAt: 1_800_000_000_000, pausedRemainingMs: null });
    expect(loadActive()?.restEndsAt).toBe(1_800_000_000_000);
  });

  it('discards a stored value from an older shape', () => {
    localStorage.setItem('kb.active.v1', JSON.stringify({ workout, stepIndex: 2 }));
    expect(loadActive()).toBeNull();
  });
});
