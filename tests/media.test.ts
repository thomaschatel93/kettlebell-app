import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { EXERCISES } from '@/lib/data/exercises';
import { parseDoNotShip } from '../scripts/import-stills.mts';

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
    // Floor Pullover is drawn with both palms flat on the round ball, against a
    // setup cue that says to hold the bell by the horns. All three are
    // regenerations, not slicing bugs.
    const missing = EXERCISES.filter((e) => e.image === null).map((e) => e.id).sort();
    expect(missing).toEqual(['clean-and-press', 'floor-pullover', 'high-pull']);
  });

  it('keeps the floor pullover unset until a picture matches its own setup cue', () => {
    const pullover = EXERCISES.find((e) => e.id === 'floor-pullover');
    expect(pullover).toBeDefined();
    expect(pullover?.image).toBeNull();
    // The cue is the thing the picture contradicted, so the cue is what pins it.
    expect(pullover?.cues.setup.join(' ')).toMatch(/by the horns/i);
    expect(existsSync('public/exercises/floor-pullover.webp')).toBe(false);
  });

  it('counts the panels the shipped file actually holds, not the ones it deserves', () => {
    // Two assets really are multi-panel: the squat-to-press pair on grid-01 and
    // the two-position Turkish get-up still.
    for (const id of ['squat-to-press', 'turkish-get-up']) {
      const e = EXERCISES.find((x) => x.id === id);
      expect(e, id).toBeDefined();
      expect(e?.imagePanels, id).toBeGreaterThan(1);
    }
  });

  it('names the ballistics that ship one frozen position, so a seventh cannot slip in', () => {
    // Pinned by name on purpose. The set-equality this replaced pointed the wrong
    // way: a seventh single-frame ballistic passed, while raising one of these to
    // two panels — the whole point of the outstanding work — failed. What is
    // worth pinning is that no OTHER ballistic joins the list, never that these
    // six stay as poor as they are.
    const SINGLE_FRAME = [
      'two-hand-swing', 'single-arm-swing', 'snatch', 'clean', 'push-press', 'figure-8',
    ];
    for (const id of SINGLE_FRAME) {
      const e = EXERCISES.find((x) => x.id === id);
      expect(e, id).toBeDefined();
      expect(e?.image, id).not.toBeNull();
      expect(e?.mechanic, id).toBe('ballistic');
    }
    const singles = EXERCISES
      .filter((e) => e.mechanic === 'ballistic' && e.image !== null && e.imagePanels === 1)
      .map((e) => e.id);
    const unexpected = singles.filter((id) => !SINGLE_FRAME.includes(id));
    expect(unexpected, `ballistics shipping a single frame that nobody recorded: ${unexpected.join(', ')}`)
      .toEqual([]);
  });
});

describe('the do-not-ship ban in docs/media-map.md', () => {
  const MAP = path.resolve(process.cwd(), 'docs', 'media-map.md');
  const markdown = readFileSync(MAP, 'utf8');

  it('excludes the banned still by name', () => {
    const banned = parseDoNotShip(markdown);
    expect([...banned.keys()])
      .toContain('a-single-athletic-male-figure--short-brown-hair--b (10).png');
    expect(banned.get('a-single-athletic-male-figure--short-brown-hair--b (10).png'))
      .toMatch(/ball/i);
  });

  it('reads the ban whatever the heading and bullet look like, because formatting is not consent', () => {
    const variants = [
      markdown.replace('## Do not ship', '## Do Not Ship'),
      markdown.replace('## Do not ship', '## Do not ship — regenerate these'),
      markdown.replace('## Do not ship', '### Do not ship'),
    ];
    for (const variant of variants) {
      expect(parseDoNotShip(variant).size, variant.slice(variant.indexOf('Do'), 40)).toBeGreaterThan(0);
    }
    const starBullet = markdown.replace(/^- \*\*`a-single/m, '* **`a-single');
    expect(parseDoNotShip(starBullet).size).toBeGreaterThan(0);
    const noBold = markdown.replace(/^- \*\*(`a-single[^`]+`)\*\*/m, '- $1');
    expect(parseDoNotShip(noBold).size).toBeGreaterThan(0);
  });

  it('throws rather than quietly ban nothing', () => {
    // The ban failing open is worse than the ban failing loudly: a silent no-op
    // ships the picture whose grip teaches the injury.
    expect(() => parseDoNotShip(markdown.replace(/^## Do not ship.*$/m, '## Notes')))
      .toThrow(/Do not ship/);
    expect(() => parseDoNotShip(markdown.replace(/^- \*\*`a-single[^\n]*$/m, '- nothing here')))
      .toThrow(/named no file/);
  });
});
