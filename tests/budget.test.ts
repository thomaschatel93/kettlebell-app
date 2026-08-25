import { describe, it, expect } from 'vitest';
import { budget } from '@/lib/budget';
import { chooseFormat } from '@/lib/format';
import { req } from './fixtures';

describe('budget', () => {
  it('always accounts for the whole time', () => {
    for (const m of [15, 20, 30, 45, 60] as const) {
      const b = budget(m);
      expect(b.warmupSeconds + b.mainSeconds + b.cooldownSeconds).toBe(m * 60);
    }
  });

  it('clamps the warm-up to between three and seven minutes', () => {
    expect(budget(15).warmupSeconds).toBe(180);
    expect(budget(60).warmupSeconds).toBe(420);
  });

  it('clamps the cool-down to between two and five minutes', () => {
    expect(budget(15).cooldownSeconds).toBe(120);
    expect(budget(60).cooldownSeconds).toBe(300);
  });
});

describe('chooseFormat', () => {
  it('respects an explicit choice', () => {
    expect(chooseFormat(req({ format: 'strength', patterns: ['hinge', 'squat', 'push', 'pull'] }), false)).toBe('strength');
  });

  it('chooses a circuit for four or more patterns', () => {
    expect(chooseFormat(req({ patterns: ['hinge', 'squat', 'push', 'pull'] }), true)).toBe('circuit');
  });

  it('chooses strength for a narrow focus and a long session', () => {
    expect(chooseFormat(req({ patterns: ['push'], totalMinutes: 45 }), true)).toBe('strength');
  });

  it('chooses a complex for a narrow focus and a short session when one fits', () => {
    expect(chooseFormat(req({ patterns: ['push'], totalMinutes: 30 }), true)).toBe('complex');
  });

  it('falls back to a circuit when no combo fits', () => {
    expect(chooseFormat(req({ patterns: ['push'], totalMinutes: 30 }), false)).toBe('circuit');
  });
});
