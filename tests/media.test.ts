import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { EXERCISES } from '@/lib/data/exercises';

describe('exercise media', () => {
  it('points every non-null image at a file that exists', () => {
    for (const e of EXERCISES) {
      if (e.image === null) continue;
      expect(existsSync(`public${e.image}`), `${e.id} -> ${e.image}`).toBe(true);
    }
  });

  it('names images after their exercise id', () => {
    for (const e of EXERCISES) {
      if (e.image !== null) expect(e.image).toBe(`/exercises/${e.id}.webp`);
    }
  });

  it('has an image for a named, hard-coded set, so a deletion cannot delete its own check', () => {
    const MUST_HAVE = [
      'two-hand-swing', 'goblet-squat', 'deadlift', 'front-lunge', 'sumo-deadlift',
      'single-arm-swing', 'overhead-press', 'russian-twist', 'step-up', 'bent-over-row',
      'halo', 'reverse-lunge', 'squat-to-press',
    ];
    for (const id of MUST_HAVE) {
      const e = EXERCISES.find((x) => x.id === id);
      expect(e, id).toBeDefined();
      expect(e!.image, id).not.toBeNull();
    }
  });

  it('never ships the clean whose grip is wrong', () => {
    // docs/media-map.md flags one generated clean as do-not-ship: the hand grips the
    // ball rather than the handle. The picture that ships instead is the rack from
    // grid-02, where the hand is on the handle and the elbow is tucked to the ribs.
    const clean = EXERCISES.find((e) => e.id === 'clean');
    expect(clean).toBeDefined();
    expect(clean!.image).toBe('/exercises/clean.webp');
  });

  it('leaves an image unset exactly where no shippable picture exists', () => {
    // Clean and Press is drawn with two bells for a one-bell single-arm lift.
    // High Pull is drawn two-handed against cues that say one hand on the handle.
    // Both are regenerations, not slicing bugs.
    const missing = EXERCISES.filter((e) => e.image === null).map((e) => e.id).sort();
    expect(missing).toEqual(['clean-and-press', 'high-pull']);
  });

  it('counts the panels the shipped file actually holds, not the ones it deserves', () => {
    // Only two assets are multi-panel: the squat-to-press pair on grid-01 and the
    // two-position Turkish get-up still. Everything else that ships is one position.
    const multi = EXERCISES.filter((e) => e.image !== null && e.imagePanels > 1).map((e) => e.id).sort();
    expect(multi).toEqual(['squat-to-press', 'turkish-get-up']);
  });
});
