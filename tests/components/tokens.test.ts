/**
 * The physical constraints, asserted against the stylesheet itself.
 *
 * Everything in this file was previously guarded only by a comment. A reviewer
 * changed --surface, changed --tap, and deleted the guard, and all 544 tests
 * stayed green. jsdom cannot compute contrast or measure a rendered box, but it
 * can read the CSS, and these constraints are all expressible as CSS facts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CARD_SURFACE } from '../../scripts/lib/card-image.mts';

const CSS = readFileSync(path.resolve(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');

/** The body of a top-level rule. None of the rules read here nest. */
function ruleBody(head: string): string {
  const at = CSS.indexOf(`${head} {`);
  expect(at, `\`${head}\` is missing from globals.css`).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', at) + 1;
  return CSS.slice(open, CSS.indexOf('}', open));
}

/** One declaration out of a rule body. `--surface` will not match `--surface-2`. */
function decl(body: string, prop: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;]+);`));
  return m?.[1].trim();
}

const root = ruleBody(':root');

describe('--surface is pinned to the colour the images were flattened onto', () => {
  /**
   * The stated worst outcome of the media pipeline. All 31 stills in
   * public/exercises were matted onto exactly this colour, so if the token
   * drifts every picture shows a visible edge against its card. The script
   * constant and the CSS token are two copies of one fact; this is what stops
   * them drifting apart in silence.
   */
  it('matches CARD_SURFACE from the media pipeline exactly', () => {
    expect(decl(root, '--surface')).toBe(CARD_SURFACE);
  });

  it('still agrees with the literal the pixel tests assert against', () => {
    expect(decl(root, '--surface')).toBe('#161618');
  });
});

describe('the 44px tap floor', () => {
  /** A wet thumb on a small control misses. */
  it('is 44px, the minimum a damp thumb reliably hits', () => {
    expect(decl(root, '--tap')).toBe('44px');
  });

  it('is carried by a utility, so the number is never retyped from memory', () => {
    const body = ruleBody('@utility tap-target');
    expect(decl(body, 'min-height')).toBe('var(--tap)');
    expect(decl(body, 'min-width')).toBe('var(--tap)');
  });
});

describe('.read-far, the mechanical form of the --text-dim ban', () => {
  /**
   * Grey on near-black passes a contrast check at a desk and is mush at a metre
   * through sweat on glass. Rather than trusting every future component to
   * remember, this reassigns the token inside the subtree, so dim text on the
   * workout and rest screens comes out at full strength whoever wrote it.
   */
  it('reassigns --text-dim to the full-strength --text', () => {
    expect(decl(ruleBody('.read-far'), '--text-dim')).toBe('var(--text)');
  });

  it('has something to lift, so the guard is not a no-op', () => {
    expect(decl(root, '--text-dim')).toBe('#9a9aa1');
    expect(decl(root, '--text')).toBe('#f5f5f6');
    expect(decl(root, '--text-dim')).not.toBe(decl(root, '--text'));
  });
});

describe('safe area', () => {
  it('pads the shell clear of the home indicator', () => {
    expect(decl(ruleBody('.app-shell'), 'padding-bottom')).toBe('env(safe-area-inset-bottom)');
  });

  /**
   * A fixed element is out of normal flow and ignores the body padding, so the
   * bottom tab bar needs its own inset or its last row sits under the home
   * indicator.
   */
  it('offers a utility a FIXED bottom bar can apply to itself', () => {
    expect(decl(ruleBody('@utility safe-bottom'), 'padding-bottom')).toBe(
      'env(safe-area-inset-bottom)',
    );
  });
});

describe('motion', () => {
  it('honours prefers-reduced-motion', () => {
    expect(CSS).toContain('prefers-reduced-motion: reduce');
  });
});
