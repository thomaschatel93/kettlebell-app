/**
 * What makes the app installable, asserted against the files that do it.
 *
 * The failure this guards is silent by construction: a manifest whose
 * background colour has drifted from the app's own shows a white flash for a
 * fifth of a second on launch, and a missing apple-touch-icon gives the Home
 * Screen a screenshot of the page instead of an icon. Neither breaks anything
 * that a test could otherwise notice.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readToken } from '../scripts/make-icons.mts';

const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
const css = readFileSync('src/app/globals.css', 'utf8');
const layout = readFileSync('src/app/layout.tsx', 'utf8');

describe('web app manifest', () => {
  it('opens standalone so it does not look like a browser tab', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('uses the app background so there is no white flash on launch', () => {
    expect(manifest.background_color).toBe('#0b0b0c');
    expect(manifest.theme_color).toBe('#0b0b0c');
  });

  it('starts at the home screen', () => expect(manifest.start_url).toBe('/'));

  it('ships both icon sizes, and they exist', () => {
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes).sort()).toEqual(['192x192', '512x512']);
    for (const i of manifest.icons) expect(existsSync(`public${i.src}`), i.src).toBe(true);
  });

  it('ships an apple touch icon, which iOS uses instead of the manifest', () => {
    expect(existsSync('public/icons/apple-touch-icon.png')).toBe(true);
  });

  /*
   * iOS ignores `orientation` entirely, so a value here would claim a lock the
   * installed app does not have. The absence is the honest state and is pinned
   * so nobody adds one back from memory.
   */
  it('claims no orientation lock, because iOS honours none', () => {
    expect(manifest.orientation).toBeUndefined();
  });

  /*
   * The launch colours are the app's own tokens, not a second copy of them.
   * Edit --bg and this fails, which is the only way anyone finds out before
   * the flash is on the phone.
   */
  it('takes its launch colour from --bg rather than a retyped hex', () => {
    expect(manifest.background_color).toBe(readToken(css, 'bg'));
  });
});

describe('the layout ships what the browser needs to find all that', () => {
  it('links the manifest', () => {
    expect(layout).toContain("manifest: \"/manifest.webmanifest\"");
  });

  it('links the apple touch icon, which is the one iOS reads', () => {
    expect(layout).toContain('/icons/apple-touch-icon.png');
  });

  it('declares itself web-app capable under both the standard and the Apple name', () => {
    expect(layout).toContain('capable: true');
    expect(layout).toContain('"apple-mobile-web-app-capable": "yes"');
  });

  /*
   * `viewport` is its own export in Next 16, not a field on `metadata`. Written
   * from memory as part of `metadata` it is dropped in silence, taking
   * viewport-fit=cover with it - and every safe-area inset in this app then
   * resolves to zero, putting the tab bar under the home indicator.
   */
  it('exports viewport separately, with viewport-fit cover and the theme colour', () => {
    expect(layout).toMatch(/export const viewport: Viewport = \{/);
    const body = layout.slice(layout.indexOf('export const viewport'));
    expect(body).toContain('viewportFit: "cover"');
    expect(body).toContain(`themeColor: "${readToken(css, 'bg')}"`);
  });
});
