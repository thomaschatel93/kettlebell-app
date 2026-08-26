import { describe, it, expect } from 'vitest';
import { generate } from '@/lib/generate';
import { ALL_EXERCISES } from '@/lib/data/ancillary';
import { COMBOS } from '@/lib/data/combos';
import { FULL_KIT, HOME_KIT, req } from './fixtures';
import type { Pattern, WorkStep, WorkoutRequest } from '@/lib/types';

const NOW = '2026-08-25T09:00:00.000Z';
const ALL: Pattern[] = ['hinge', 'squat', 'push', 'pull', 'carry', 'core'];
const FEW: Pattern[] = ['hinge', 'squat', 'push'];

const run = (o: Partial<WorkoutRequest>, kit = FULL_KIT) =>
  generate({ request: req({ capability: 'advanced', ...o }), kit, exercises: ALL_EXERCISES, combos: COMBOS, history: [], now: NOW });

const isMainWork = (s: { kind: string; block?: string }): s is WorkStep =>
  s.kind === 'work' && (s as WorkStep).block === 'Main';

describe('the real database drives the engine', () => {
  /**
   * NOTE on what this establishes: mutation testing (fix round 1) showed that halving,
   * flooring, or otherwise mangling `defaultReps` across the whole database leaves this
   * assertion untouched. `prescribe()` floors reps at three and the time model is
   * rest-dominated (30s between items, 75-90s between rounds), so "fills its time
   * budget" is mostly a claim about there being enough exercise VARIETY to build a
   * session from — not a claim that rep values are sane. The `spends a sensible share
   * of the clock on work` test below is what actually exercises the reps axis.
   */
  it('fills every auto-format session to within ten per cent', () => {
    for (const totalMinutes of [15, 20, 30, 45, 60] as const) {
      for (const seed of [1, 2, 3]) {
        const w = run({ totalMinutes, patterns: ALL, format: 'auto', seed });
        expect(w.shortOfBudget, `${totalMinutes}min seed ${seed} -> ${w.estimatedSeconds}s`).toBe(false);
      }
    }
  });

  /**
   * The axis the test above does not cover. Measured on the real database: work share
   * for a 30-minute auto session sits at 53-56% across seeds; setting every
   * `defaultReps` to 1 (still floored to 3 reps by `prescribe`) drags it down to
   * 37-43%. 0.45 sits cleanly between the two, so this fails on the mutation the
   * previous test missed without being sensitive to ordinary seed noise.
   */
  it('spends a sensible share of the clock on work, not just rest', () => {
    for (const seed of [1, 2, 3]) {
      const w = run({ totalMinutes: 30, patterns: ALL, format: 'auto', seed });
      const workSeconds = w.steps.filter((s) => s.kind === 'work').reduce((a, s) => a + s.estSeconds, 0);
      const share = workSeconds / w.estimatedSeconds;
      expect(share, `seed ${seed} -> ${(share * 100).toFixed(1)}% work`).toBeGreaterThan(0.45);
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

  /**
   * The class of defect Task 12's review actually found: a pattern thinning to one
   * usable candidate for a beginner on one bell. `data-exercises.test.ts` guards the
   * raw counts; this guards the same thing on real generated output, which is the
   * job this file exists for. Beginner + single bell is the worst case, matching the
   * scenario the five Task 12 exercises were added to fix.
   */
  it('draws on more than one exercise per pattern for a beginner on a single bell', () => {
    for (const p of ALL) {
      const ids = new Set<string>();
      for (const seed of [1, 2, 3, 4, 5]) {
        const w = run({ capability: 'beginner', patterns: [p], format: 'circuit', seed }, HOME_KIT);
        w.steps.filter(isMainWork).forEach((s) => ids.add(s.exerciseId));
      }
      expect(ids.size, `${p}: ${[...ids].join(', ') || '(none)'}`).toBeGreaterThan(1);
    }
  });

  it('builds a complex at every capability that has one', () => {
    for (const capability of ['intermediate', 'advanced'] as const) {
      const w = run({ capability, patterns: ['push'], format: 'complex', seed: 2 });
      expect(w.format, capability).toBe('complex');
    }
  });

  /**
   * One combo per pattern is a fixed prescription, not a database. Two of the seven
   * combos qualify for a push-only request; over twelve seeds both surface, so a
   * deleted combo (down to one) collapsing this to a single signature is caught.
   */
  it('does not always choose the same complex chain for a given pattern', () => {
    const signatures = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const w = run({ patterns: ['push'], format: 'complex', seed });
      const ids = [...new Set(w.steps.filter(isMainWork).map((s) => s.exerciseId))].sort().join('+');
      signatures.add(ids);
    }
    expect(signatures.size, [...signatures].join(' | ')).toBeGreaterThan(1);
  });

  it('gives a beginner on a single bell a real session', () => {
    const w = run({ capability: 'beginner', patterns: ['hinge', 'squat'], totalMinutes: 20, seed: 1 }, HOME_KIT);
    expect(w.steps.filter((s) => s.kind === 'work' && s.block === 'Main').length).toBeGreaterThan(3);
    expect(w.loadWarning).toBe(true);
  });

  it('produces real work in all three blocks, not just the one this file mostly checks', () => {
    const w = run({ totalMinutes: 30, patterns: ALL, format: 'auto', seed: 1 });
    const blocksWithWork = new Set(w.steps.filter((s) => s.kind === 'work').map((s) => s.block));
    for (const block of ['Warm-up', 'Main', 'Cool-down'] as const) {
      expect(blocksWithWork, [...blocksWithWork].join(', ')).toContain(block);
    }
  });

  /**
   * Two shortfalls exist in the real engine/data pairing today, and neither is a
   * data problem for this task to fix: `chooseFormat` never sends an `auto` request
   * to either configuration (auto only reaches `strength` at >=35min, and only
   * reaches `complex` when four-plus patterns have not already forced `circuit`).
   * Recorded here as known, bounded behaviour rather than left free to drift
   * silently worse. If the engine is later improved and one of these stops being
   * short, that is a good failure — update the pinned bound to match, do not
   * loosen it pre-emptively.
   */
  describe('known, pre-existing engine shortfalls (not reachable via auto)', () => {
    it('forced strength at 15 minutes on a single bell overshoots the budget by a bounded amount', () => {
      const w = run({ patterns: FEW, format: 'strength', totalMinutes: 15, seed: 1 }, HOME_KIT);
      const dev = Math.abs(w.estimatedSeconds - 900) / 900;
      expect(w.shortOfBudget, `estimated ${w.estimatedSeconds}s vs 900s target`).toBe(true);
      expect(dev).toBeGreaterThan(0.10);
      expect(dev).toBeLessThan(0.35);
    });

    it('forced complex on a single narrow pattern falls short at 45 and 60 minutes by a bounded amount', () => {
      for (const kit of [FULL_KIT, HOME_KIT]) {
        for (const totalMinutes of [45, 60] as const) {
          const w = run({ patterns: ['push'], format: 'complex', totalMinutes, seed: 1 }, kit);
          const target = totalMinutes * 60;
          const dev = Math.abs(w.estimatedSeconds - target) / target;
          expect(w.shortOfBudget, `${kit.name} ${totalMinutes}min: ${w.estimatedSeconds}s vs ${target}s`).toBe(true);
          expect(dev, `${kit.name} ${totalMinutes}min`).toBeGreaterThan(0.10);
          expect(dev, `${kit.name} ${totalMinutes}min`).toBeLessThan(0.45);
        }
      }
    });
  });
});
