import { describe, it, expect } from 'vitest';
import { EXERCISES, byId } from '@/lib/data/exercises';
import { PATTERNS, CAPABILITIES } from '@/lib/types';

describe('main exercise database', () => {
  it('holds the 29 main exercises', () => {
    expect(EXERCISES).toHaveLength(29);
  });

  it('has unique kebab-case ids', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('uses only known patterns and capabilities, and names at least one pattern', () => {
    for (const e of EXERCISES) {
      expect(e.patterns.length).toBeGreaterThan(0);
      for (const p of e.patterns) expect(PATTERNS).toContain(p);
      expect(CAPABILITIES).toContain(e.capability);
    }
  });

  it('gives every exercise a way to be prescribed', () => {
    for (const e of EXERCISES) expect(e.defaultReps ?? e.defaultWorkSeconds).toBeDefined();
  });

  it('sets exactly one of reps or work seconds, never both', () => {
    for (const e of EXERCISES) {
      const hasReps = e.defaultReps !== undefined;
      const hasSeconds = e.defaultWorkSeconds !== undefined;
      expect(hasReps !== hasSeconds, e.id).toBe(true);
    }
  });

  it('gives every exercise all three kinds of cue', () => {
    for (const e of EXERCISES) {
      expect(e.cues.setup.length, e.id).toBeGreaterThan(0);
      expect(e.cues.execution.length, e.id).toBeGreaterThan(0);
      expect(e.cues.mistakes.length, e.id).toBeGreaterThan(0);
    }
  });

  it('offers at least three candidates for every pattern', () => {
    for (const p of PATTERNS) {
      expect(EXERCISES.filter((e) => e.patterns.includes(p)).length, p).toBeGreaterThanOrEqual(3);
    }
  });

  it('offers at least three primary candidates for every pattern', () => {
    for (const p of PATTERNS) {
      expect(EXERCISES.filter((e) => e.patterns[0] === p).length, p).toBeGreaterThanOrEqual(3);
    }
  });

  it('marks none of them as ancillary', () => {
    for (const e of EXERCISES) {
      expect(e.warmupSuitable).toBe(false);
      expect(e.cooldownSuitable).toBe(false);
    }
  });

  it('gives every ballistic more than one panel, because one still cannot teach it', () => {
    for (const e of EXERCISES) {
      if (e.mechanic === 'ballistic') expect(e.imagePanels, e.id).toBeGreaterThan(1);
    }
  });

  it('measures carries in time, not reps', () => {
    for (const e of EXERCISES) {
      if (e.mechanic !== 'carry') continue;
      expect(e.defaultWorkSeconds, e.id).toBeGreaterThan(0);
      expect(e.secondsPerRep, e.id).toBe(0);
    }
  });

  it('leaves every image unset for the slicing task', () => {
    for (const e of EXERCISES) expect(e.image, e.id).toBeNull();
  });

  it('has no Front Raise', () => expect(byId('front-raise')).toBeUndefined());

  it('includes all three carries', () => {
    for (const id of ['farmers-carry', 'suitcase-carry', 'racked-carry']) {
      expect(byId(id), id).toBeDefined();
    }
  });

  it('keeps the fifteen sliced ids exactly as the image task expects', () => {
    const sliced = [
      'two-hand-swing', 'goblet-squat', 'deadlift', 'clean-and-press', 'front-lunge',
      'sumo-deadlift', 'single-arm-swing', 'overhead-press', 'russian-twist', 'step-up',
      'bent-over-row', 'snatch', 'halo', 'reverse-lunge', 'squat-to-press',
    ];
    for (const id of sliced) expect(byId(id), id).toBeDefined();
  });

  it('marks the Turkish get-up advanced with three panels', () => {
    const tgu = byId('turkish-get-up');
    expect(tgu?.capability).toBe('advanced');
    expect(tgu?.imagePanels).toBe(3);
  });

  it('needs a bench only where the movement really needs one', () => {
    const benched = EXERCISES.filter((e) => e.needsBench).map((e) => e.id).sort();
    expect(benched).toEqual(['bulgarian-split-squat', 'step-up']);
  });
});
