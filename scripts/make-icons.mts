/**
 * Render the Home Screen icons.
 *
 * The app has no logo, so the icon is drawn here rather than imported: a
 * kettlebell silhouette in the accent colour on the app background. Drawing it
 * in code means the file that defines the shape is also the file that defines
 * the sizes, and re-running the script is the only way any of them change.
 *
 * Two things are load-bearing.
 *
 * **The colours are read out of `globals.css`, not retyped.** The manifest's
 * `background_color` has to be the same near-black the first paint uses or the
 * launch flashes. Copying the hex here would let the two drift the moment a
 * token is edited, and the failure - a white flash for a fifth of a second on
 * launch - is exactly the kind nobody files a bug about.
 *
 * **The drawing stays inside the maskable safe zone.** The manifest declares
 * `purpose: "any maskable"`, which lets a platform crop the icon to whatever
 * shape it likes, guaranteeing only the centre circle of 80% diameter. So the
 * whole kettlebell sits within a circle of radius 0.4 * size about the centre,
 * and the background covers the full square so a crop never exposes a corner.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOKENS = path.join(ROOT, 'src', 'app', 'globals.css');
const OUT_DIR = path.join(ROOT, 'public', 'icons');

/** The icons to write: the two the manifest names, plus the one iOS actually uses. */
const SIZES: ReadonlyArray<{ readonly file: string; readonly px: number }> = [
  { file: 'icon-192.png', px: 192 },
  { file: 'icon-512.png', px: 512 },
  // iOS reads this link tag rather than the manifest's icons, and 180 is the
  // size it asks for on every current iPhone.
  { file: 'apple-touch-icon.png', px: 180 },
];

/**
 * Pull one custom property's value out of the token block.
 *
 * It throws on a miss rather than falling back to a default: a silent fallback
 * would ship a black-on-black icon and look like a rendering bug.
 */
export function readToken(css: string, name: string): string {
  const match = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(css);
  const value = match?.[1]?.trim();
  if (value === undefined || value === '') {
    throw new Error(`${TOKENS}: no --${name}. The icons take their colours from the tokens, not from memory.`);
  }
  return value;
}

/**
 * A kettlebell on a 512 grid, scaled to whatever size is asked for.
 *
 * The handle window decides whether this reads as a kettlebell or a padlock,
 * and three earlier drafts read as a padlock. What fixes it is the window being
 * LANDSCAPE - a broad, low arch about 112 wide by 54 tall - over a bell that is
 * wider than it is tall. A tall narrow window is a shackle, whatever the body
 * under it looks like.
 *
 * The handle is one filled path with an evenodd hole rather than a stroke, so
 * its outer sides can taper into the bell's shoulders instead of ending in two
 * spikes poking out of it.
 */
export function kettlebellSvg(px: number, background: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${background}"/>
  <g fill="${accent}" transform="translate(0 -34)">
    <path fill-rule="evenodd" d="M168 284 C166 194 202 140 256 140 C310 140 346 194 344 284 Z
          M200 284 C200 214 224 186 256 186 C288 186 312 214 312 284 Z"/>
    <ellipse cx="256" cy="340" rx="124" ry="100"/>
  </g>
</svg>`;
}

async function main(): Promise<void> {
  const tokens = await readFile(TOKENS, 'utf8');
  const background = readToken(tokens, 'bg');
  const accent = readToken(tokens, 'accent');

  await mkdir(OUT_DIR, { recursive: true });
  for (const { file, px } of SIZES) {
    const svg = kettlebellSvg(px, background, accent);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    await writeFile(path.join(OUT_DIR, file), png);
    console.log(`${file}  ${px}x${px}`);
  }
  console.log(`\n${SIZES.length} icons written to public/icons, ${accent} on ${background}.`);
}

/**
 * Only draw when this file is the process entry point, so a test can import
 * `readToken` and `kettlebellSvg` without rewriting `public/icons/` as a side
 * effect.
 */
const entry = process.argv[1];
if (entry !== undefined && path.resolve(entry) === import.meta.filename) {
  await main();
}
