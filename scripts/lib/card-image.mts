/**
 * Turning a source illustration into a card-ready WebP.
 *
 * Two things here are load-bearing.
 *
 * **The matte.** Every source sheet and still is fully opaque with a pure white
 * background, so `sharp.flatten()` on its own does nothing at all: it only
 * replaces transparency, and there is none. Shipped as-is, each tile punches a
 * white square through the dark card, which is the most visible defect this
 * pipeline can produce. So the outside is found first — a flood fill inwards
 * from the border across light pixels — and made transparent before flattening
 * onto the card colour. The fill is done from the border rather than by matching
 * white everywhere, because the figures wear white socks and white shoe stripes
 * and those are enclosed by the outline: a blanket white-to-alpha would punch
 * holes straight through them.
 *
 * **The pockets the border cannot reach.** Some background is walled off: the
 * gap between an arm and a torso, the space at a waist, the window inside a
 * kettlebell handle. Those pockets are background and must go dark, while a
 * white sock must not. See `isWalledOffBackground` for how the two are told
 * apart, and why the answer cannot be how big the pocket is.
 *
 * **No upscaling.** The tiles come out small, some under 200px. `resize` is
 * capped with `withoutEnlargement`, so a crisp small image is what ships and CSS
 * scales it down on the card. A soft blown-up one would be worse.
 */
import sharp from 'sharp';

/** `--surface`: the colour of the card these images sit on. */
export const CARD_SURFACE = '#161618';
/** Darker than this counts as drawn content rather than background. */
export const CONTENT_MAX_LUMA = 235;
/**
 * Lighter than this, and touching the border, counts as outside the figure.
 * Set below pure white so the anti-aliased ramp around the black outline is
 * carried into the matte too, instead of surviving as a pale halo.
 */
const EXTERIOR_MIN_LUMA = 200;
/** Breathing room kept around the drawn content. */
export const PADDING = 10;
/** Dark enough to be the drawing's ink rather than a fill colour. */
const OUTLINE_MAX_LUMA = 128;
/**
 * A distance band counts as part of the outline shell while at least this share
 * of the pixels in it are ink. The interior of a figure never gets near it: it
 * runs at 40–65% ink, because it is a mix of line work and flat fill, while every
 * stroke band measured across the 32 tiles here sits at 71% or above.
 */
const SHELL_INK_SHARE = 0.7;
/** How far each channel may sit from the background's own colour and still match it. */
const BACKGROUND_TOLERANCE = 8;
/** The longest edge any tile is allowed to reach. Nothing is ever enlarged to it. */
const MAX_EDGE = 900;

export interface Region {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * The smallest region holding every drawn pixel, plus padding. Used to trim the
 * individual stills, which are 1024x1024 with the figure adrift in white.
 */
export async function contentRegion(source: string): Promise<Region> {
  const { data, info } = await sharp(source).flatten({ background: '#ffffff' }).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if ((data[row + x] ?? 255) < CONTENT_MAX_LUMA) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < left || bottom < top) throw new Error(`${source}: no drawn content found`);
  const l = Math.max(0, left - PADDING);
  const t = Math.max(0, top - PADDING);
  return {
    left: l,
    top: t,
    width: Math.min(width - l, right - left + 1 + PADDING * 2),
    height: Math.min(height - t, bottom - top + 1 + PADDING * 2),
  };
}


/** The colour that occurs most often across a set of pixels, packed as 0xRRGGBB. */
function modalColour(pixels: readonly number[], rgba: Buffer): number {
  const counts = new Map<number, number>();
  for (const p of pixels) {
    const i = p * 4;
    const key = ((rgba[i] ?? 0) << 16) | ((rgba[i + 1] ?? 0) << 8) | (rgba[i + 2] ?? 0);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = 0xffffff;
  let most = -1;
  for (const [key, n] of counts) {
    if (n > most) { most = n; best = key; }
  }
  return best;
}

function matchesColour(a: number, b: number): boolean {
  return Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) <= BACKGROUND_TOLERANCE
    && Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) <= BACKGROUND_TOLERANCE
    && Math.abs((a & 255) - (b & 255)) <= BACKGROUND_TOLERANCE;
}

/**
 * How many pixels thick the drawing's outline is, measured rather than assumed.
 *
 * Walking outwards from the exterior, the first band is the stroke's
 * anti-aliased ramp, which is only half ink. Behind it come the bands that are
 * almost pure ink: the stroke itself. Once the stroke is crossed the ink share
 * collapses to the 40–65% that a mix of line work and flat fill produces. So the
 * ramp is skipped, and the stroke ends at the last band still above
 * `SHELL_INK_SHARE`.
 *
 * Measured here it comes out at 2px on grid-01, 3px on grid-02 and 4–5px on the
 * 1024px stills: the same drawing style at three scales, which is exactly why
 * this is measured per image rather than written down as a number.
 */
function outlineThickness(dist: Int32Array, isInk: (p: number) => boolean): number {
  const total: number[] = [];
  const ink: number[] = [];
  for (let p = 0; p < dist.length; p += 1) {
    const d = dist[p] ?? -1;
    if (d < 1) continue;
    total[d] = (total[d] ?? 0) + 1;
    if (isInk(p)) ink[d] = (ink[d] ?? 0) + 1;
  }
  let thickness = 1;
  let started = false;
  for (let d = 1; d < total.length; d += 1) {
    const n = total[d] ?? 0;
    if (n === 0) break;
    const share = (ink[d] ?? 0) / n;
    if (share >= SHELL_INK_SHARE) { started = true; thickness = d; continue; }
    if (started) break;
  }
  return thickness;
}

/** How far every pixel sits from the exterior, in 4-connected steps. */
function distanceFromExterior(exterior: Uint8Array, width: number, height: number): Int32Array {
  const dist = new Int32Array(width * height).fill(-1);
  let frontier: number[] = [];
  for (let p = 0; p < width * height; p += 1) {
    if (exterior[p] === 1) { dist[p] = 0; frontier.push(p); }
  }
  for (let d = 1; frontier.length > 0; d += 1) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % width;
      const y = (p - x) / width;
      const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1];
      for (const q of neighbours) {
        if (q < 0 || dist[q] !== -1) continue;
        dist[q] = d;
        next.push(q);
      }
    }
    frontier = next;
  }
  return dist;
}

/**
 * Whether one enclosed light region is walled-off background rather than
 * something the figure wears.
 *
 * The old rule asked how big the region was, and that is the wrong question: a
 * pocket of background between an arm and a torso is exactly as white as a
 * pocket ten times its size, and the real ones measured here run from 0.10% of
 * a tile to 1.2%, straight through anything a threshold could separate. Size is
 * not evidence. Two things are, and neither depends on area:
 *
 * 1. **It is the background's own colour.** The region's most common colour has
 *    to be the colour the exterior is painted in. A highlight on a bell handle
 *    is a flat 241 grey and a shorts stripe a flat 203; both are light enough to
 *    be caught by the flood fill's threshold, and neither is the background.
 * 2. **It is behind the figure, not on it.** A white sock sits against the
 *    silhouette: the only thing between it and the exterior is the outline
 *    stroke. A background pocket is walled off by a whole limb. So the region
 *    has to stand further from the exterior than the outline is thick — and the
 *    outline's thickness is measured from this image, not assumed, so the same
 *    rule holds for a 130px tile and a 900px still.
 *
 * Both tests are properties of the drawing. Neither asks how large the pocket
 * happens to be, so improving the artwork cannot break them.
 */
export function enclosedBackground(
  isLight: (byteOffset: number) => boolean,
  rgba: Buffer,
  exterior: Uint8Array,
  width: number,
  height: number,
): number[] {
  const isInk = (p: number): boolean => {
    const i = p * 4;
    return luma(rgba[i] ?? 255, rgba[i + 1] ?? 255, rgba[i + 2] ?? 255) < OUTLINE_MAX_LUMA;
  };
  const dist = distanceFromExterior(exterior, width, height);
  const outline = outlineThickness(dist, isInk);

  const exteriorPixels: number[] = [];
  for (let p = 0; p < width * height; p += 1) if (exterior[p] === 1) exteriorPixels.push(p);
  const background = modalColour(exteriorPixels, rgba);

  const seen = new Uint8Array(width * height);
  const found: number[] = [];
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] === 1 || exterior[start] === 1 || !isLight(start * 4)) continue;
    const region: number[] = [];
    const stack = [start];
    seen[start] = 1;
    let nearest = Number.MAX_SAFE_INTEGER;
    while (stack.length > 0) {
      const p = stack.pop();
      if (p === undefined) break;
      region.push(p);
      const d = dist[p] ?? 0;
      if (d < nearest) nearest = d;
      const x = p % width;
      const y = (p - x) / width;
      const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1];
      for (const q of neighbours) {
        if (q < 0 || seen[q] === 1 || exterior[q] === 1 || !isLight(q * 4)) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    // `outline + 1` is where a region lying directly against the stroke starts,
    // so anything at or below that is on the figure's surface.
    if (nearest <= outline + 1) continue;
    if (!matchesColour(modalColour(region, rgba), background)) continue;
    found.push(...region);
  }
  return found;
}

/**
 * Write one card-ready WebP: optionally cropped, matted onto the card colour,
 * never enlarged.
 */
export async function writeCardWebp(
  source: string,
  region: Region | null,
  outPath: string,
): Promise<{ width: number; height: number }> {
  const base = region === null ? sharp(source) : sharp(source).extract(region);
  const { data, info } = await base.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`${source}: expected RGBA, got ${channels} channels`);

  const rgba = Buffer.from(data);
  const isLight = (i: number): boolean => {
    const alpha = rgba[i + 3] ?? 255;
    if (alpha < 8) return true;
    return luma(rgba[i] ?? 255, rgba[i + 1] ?? 255, rgba[i + 2] ?? 255) >= EXTERIOR_MIN_LUMA;
  };

  // Flood fill inwards from the border. Anything light and reachable from the
  // edge is outside the figure; anything light but enclosed (socks, the white
  // stripe on the shorts, shoe flashes) is left alone.
  const exterior = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (exterior[p] === 1) return;
    if (!isLight(p * 4)) return;
    exterior[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y += 1) { push(0, y); push(width - 1, y); }
  const drain = (): void => {
    while (stack.length > 0) {
      const p = stack.pop();
      if (p === undefined) break;
      const x = p % width;
      const y = (p - x) / width;
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    }
  };
  drain();

  // Not all background is reachable from the border. A bent-over row walls a
  // whole pocket of white off behind the arm, the torso and the bench, and left
  // alone it ships as a white hole in the middle of a dark card. Nine tiles
  // shipped one. `enclosedBackground` finds them by colour and by how far they
  // stand behind the outline, never by how big they are.
  const enclosedFill = enclosedBackground(isLight, rgba, exterior, width, height);
  for (const p of enclosedFill) { exterior[p] = 1; }

  // Alpha follows how dark the pixel is, so the outline's anti-aliased ramp
  // fades into the card instead of ending in a hard, pale edge.
  for (let p = 0; p < width * height; p += 1) {
    if (exterior[p] !== 1) continue;
    const i = p * 4;
    const l = luma(rgba[i] ?? 255, rgba[i + 1] ?? 255, rgba[i + 2] ?? 255);
    rgba[i + 3] = Math.max(0, Math.min(255, Math.round(255 - l)));
  }

  const result = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: CARD_SURFACE })
    .webp({ quality: 92, effort: 6 })
    .toFile(outPath);
  return { width: result.width, height: result.height };
}
