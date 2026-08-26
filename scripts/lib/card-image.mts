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
/**
 * How much of a tile a light region has to cover before it is read as walled-off
 * background rather than something the figure is wearing.
 */
const ENCLOSED_BACKGROUND_FRACTION = 0.0075;
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


/**
 * Light regions that no border touches but that are too large to be anything the
 * figure is wearing. Returns their pixel indices.
 */
function enclosedBackground(
  isLight: (byteOffset: number) => boolean,
  exterior: Uint8Array,
  width: number,
  height: number,
): number[] {
  const minArea = ENCLOSED_BACKGROUND_FRACTION * width * height;
  const seen = new Uint8Array(width * height);
  const found: number[] = [];
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] === 1 || exterior[start] === 1 || !isLight(start * 4)) continue;
    const region: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const p = stack.pop();
      if (p === undefined) break;
      region.push(p);
      const x = p % width;
      const y = (p - x) / width;
      const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1];
      for (const q of neighbours) {
        if (q < 0 || seen[q] === 1 || exterior[q] === 1 || !isLight(q * 4)) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    if (region.length >= minArea) found.push(...region);
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
  // alone it ships as a white hole in the middle of a dark card. Such a pocket
  // is far bigger than any white the figure actually wears: measured across
  // every tile in this project, socks and shorts stripes stay under 0.55% of the
  // tile, while every real background pocket is over 1.1%. Anything above the
  // threshold between them is treated as background too.
  const enclosedFill = enclosedBackground(isLight, exterior, width, height);
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
