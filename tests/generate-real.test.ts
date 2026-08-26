import { describe, it, expect } from 'vitest';
import { generate } from '@/lib/generate';
import { ALL_EXERCISES } from '@/lib/data/ancillary';
import { COMBOS } from '@/lib/data/combos';
import { FULL_KIT, HOME_KIT, req } from './fixtures';
import type { Pattern, WorkStep, WorkoutRequest } from '@/lib/types';

const NOW = '2026-08-25T09:00:00.000Z';
const ALL: Pattern[] = ['hinge', 'squat', 'push', 'pull', 'carry', 'core'];

const run = (o: Partial<WorkoutRequest>, kit = FULL_KIT) =>
  generate({ request: req({ capability: 'advanced', ...o }), kit, exercises: ALL_EXERCISES, combos: COMBOS, history: [], now: NOW });

describe('the real database drives the engine', () => {
  it('fills every auto-format session to within ten per cent', () => {
    for (const totalMinutes of [15, 20, 30, 45, 60] as const) {
      for (const seed of [1, 2, 3]) {
        const w = run({ totalMinutes, patterns: ALL, format: 'auto', seed });
        expect(w.shortOfBudget, `${totalMinutes}min seed ${seed} -> ${w.estimatedSeconds}s`).toBe(false);
      }
    }
  });

  it('covers every pattern in a circuit, on both kits', () => {
    for (const kit of [FULL_KIT, HOME_KIT]) {
      const w = run({ patterns: ALL, format: 'circuit', seed: 3 }, kit);
      const covered = new Set(
        w.steps.filter((s): s is WorkStep => s.kind === 'work' && s.block === 'Main')
          .flatMap((s) => ALL_EXERCISES.find((e) => e.id === s.exerciseId)!.patterns),
      );
      // A single-bell kit cannot do a farmer's carry, so carry may be uncoverable.
      for (const p of ALL.filter((x) => kit === FULL_KIT || x !== 'carry')) {
        expect(covered, `${kit.name} ${p}`).toContain(p);
      }
    }
  });

  it('builds a complex at every capability that has one', () => {
    for (const capability of ['intermediate', 'advanced'] as const) {
      const w = run({ capability, patterns: ['push'], format: 'complex', seed: 2 });
      expect(w.format, capability).toBe('complex');
    }
  });

  it('gives a beginner on a single bell a real session', () => {
    const w = run({ capability: 'beginner', patterns: ['hinge', 'squat'], totalMinutes: 20, seed: 1 }, HOME_KIT);
    expect(w.steps.filter((s) => s.kind === 'work' && s.block === 'Main').length).toBeGreaterThan(3);
    expect(w.loadWarning).toBe(true);
  });
});
