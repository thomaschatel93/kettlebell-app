/**
 * What the shipped files actually contain, pixel by pixel.
 *
 * Everything else about this pipeline was covered by tests that read the data
 * and never opened an image, and that is precisely how nine tiles shipped with
 * white background pockets while the suite stayed green. The stated worst
 * outcome of this task is a white square on a dark card, so something has to
 * look at the cards.
 *
 * These read `public/exercises/` rather than a list, so a new picture is covered
 * the moment it lands.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { EXERCISES } from '@/lib/data/exercises';
import { SHEETS, detectCells } from '../scripts/slice-grid.mts';
import { contentRegion, enclosedBackground, CARD_SURFACE } from '../scripts/lib/card-image.mts';

const DIR = path.resolve(process.cwd(), 'public', 'exercises');
const SOURCE_DIR = path.resolve(process.cwd(), 'media-source');

/** `#161618`, the card colour every tile is matted onto. */
const CARD = [0x16, 0x16, 0x18] as const;
/**
 * WebP at quality 92 moves a flat field by a few counts. Measured across every
 * shipped tile the corners land within 5 of the card colour, so 6 is the loosest
 * this can be while still failing an un-matted white corner by a mile.
 */
const CARD_TOLERANCE = 6;
/**
 * A pixel counts as near-white when every channel is high AND the three are
 * close together. The chroma half matters: skin in this artwork sits at luma
 * 209, so a plain brightness test would swallow whole limbs.
 */
const WHITE_MIN_CHANNEL = 200;
const WHITE_MAX_SPREAD = 12;
/**
 * The largest near-white blob a tile may hold, as a share of the tile.
 *
 * The figures wear real white: socks, shoe soles, a stripe down the shorts. The
 * biggest of those measured across all shipped tiles is the sock on the clean at
 * 0.50%, so the bound sits at twice that. It is a backstop against a gross
 * regression — a pocket the size of the one the bent-over row used to ship was
 * 5.65% — not a proof that every pocket is gone. Nothing measurable in a
 * finished tile separates a small pocket from a sock, which is the same reason
 * area was the wrong rule for finding them in the first place.
 */
const MAX_WHITE_FRACTION = 0.01;

interface Tile {
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly data: Buffer;
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.webp')).sort();
const tiles = new Map<string, Tile>();
/** Every source region an output was cut from, by exercise id. */
const sources = new Map<string, { width: number; height: number }>();

/**
 * The individual stills, by the exercise they were imported for. Named here
 * rather than re-parsed so the test does not lean on the same document the
 * importer does: if the map and the pipeline drift, this notices.
 */
const STILLS = new Map<string, string>([
  ['racked-front-squat', 'a-single-athletic-male-figure--short-brown-hair--b (1).png'],
  ['floor-press', 'a-single-athletic-male-figure--short-brown-hair--b (3).png'],
  ['single-leg-deadlift', 'a-single-athletic-male-figure--short-brown-hair--b (4).png'],
  ['farmers-carry', 'a-single-athletic-male-figure--short-brown-hair--b (5).png'],
  ['suitcase-carry', 'a-single-athletic-male-figure--short-brown-hair--b (6).png'],
  ['windmill', 'a-single-athletic-male-figure--short-brown-hair--b (8).png'],
  ['renegade-row', 'a-single-athletic-male-figure--short-brown-hair--b (9).png'],
  ['turkish-get-up', 'two-positions-of-the-same-character-shown-side-by-.png'],
]);

beforeAll(async () => {
  for (const file of files) {
    const { data, info } = await sharp(path.join(DIR, file)).removeAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    tiles.set(file, { file, width: info.width, height: info.height, data });
  }
  for (const sheet of SHEETS) {
    const cells = await detectCells(sheet, SOURCE_DIR);
    cells.forEach((cell, i) => {
      const id = sheet.ids[i];
      if (id === null || id === undefined) return;
      sources.set(id, { width: cell.width, height: cell.height });
    });
  }
  for (const file of files) {
    const id = file.replace(/\.webp$/, '');
    if (sources.has(id)) continue;
    const still = EXERCISES.find((e) => e.id === id);
    expect(still, `${file} matches no exercise`).toBeDefined();
    // Anything not off a grid sheet came from a still, trimmed to its content.
    const name = STILLS.get(id);
    expect(name, `no still recorded for ${id}`).toBeDefined();
    const region = await contentRegion(path.join(SOURCE_DIR, name ?? ''));
    sources.set(id, { width: region.width, height: region.height });
  }
}, 60_000);

function pixel(tile: Tile, x: number, y: number): readonly [number, number, number] {
  const i = (y * tile.width + x) * 3;
  return [tile.data[i] ?? 0, tile.data[i + 1] ?? 0, tile.data[i + 2] ?? 0];
}

function isNearWhite(tile: Tile, p: number): boolean {
  const i = p * 3;
  const r = tile.data[i] ?? 0;
  const g = tile.data[i + 1] ?? 0;
  const b = tile.data[i + 2] ?? 0;
  const min = Math.min(r, g, b);
  return min >= WHITE_MIN_CHANNEL && Math.max(r, g, b) - min <= WHITE_MAX_SPREAD;
}

/** The size of the biggest 4-connected run of near-white pixels in a tile. */
function largestWhiteRegion(tile: Tile): { size: number; at: [number, number] } {
  const { width, height } = tile;
  const seen = new Uint8Array(width * height);
  let best = 0;
  let bestAt: [number, number] = [0, 0];
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] === 1 || !isNearWhite(tile, start)) continue;
    let size = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const p = stack.pop();
      if (p === undefined) break;
      size += 1;
      const x = p % width;
      const y = (p - x) / width;
      const around = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1];
      for (const q of around) {
        if (q < 0 || seen[q] === 1 || !isNearWhite(tile, q)) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    if (size > best) {
      best = size;
      bestAt = [start % width, (start - (start % width)) / width];
    }
  }
  return { size: best, at: bestAt };
}

describe('what the shipped tiles contain', () => {
  it('has a file to look at in the first place', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(CARD_SURFACE).toBe('#161618');
  });

  it('mattes every corner onto the card colour, so no tile punches a light square through the card', () => {
    for (const file of files) {
      const tile = tiles.get(file);
      expect(tile, file).toBeDefined();
      if (tile === undefined) continue;
      const corners: readonly (readonly [number, number])[] = [
        [0, 0], [tile.width - 1, 0], [0, tile.height - 1], [tile.width - 1, tile.height - 1],
      ];
      for (const [x, y] of corners) {
        const rgb = pixel(tile, x, y);
        for (let c = 0; c < 3; c += 1) {
          expect(Math.abs((rgb[c] ?? 0) - (CARD[c] ?? 0)), `${file} at ${x},${y} is rgb(${rgb.join(',')})`)
            .toBeLessThanOrEqual(CARD_TOLERANCE);
        }
      }
    }
  });

  it('holds no light field bigger than the white the figures actually wear', () => {
    for (const file of files) {
      const tile = tiles.get(file);
      expect(tile, file).toBeDefined();
      if (tile === undefined) continue;
      const { size, at } = largestWhiteRegion(tile);
      const fraction = size / (tile.width * tile.height);
      expect(fraction, `${file}: ${size}px near-white from ${at.join(',')}, ${(100 * fraction).toFixed(3)}% of the tile`)
        .toBeLessThan(MAX_WHITE_FRACTION);
    }
  });

  it('never enlarges a source: no tile is bigger than the crop it came from', () => {
    for (const file of files) {
      const id = file.replace(/\.webp$/, '');
      const tile = tiles.get(file);
      const source = sources.get(id);
      expect(source, `no source recorded for ${file}`).toBeDefined();
      if (tile === undefined || source === undefined) continue;
      expect(tile.width, `${file} width`).toBeLessThanOrEqual(source.width);
      expect(tile.height, `${file} height`).toBeLessThanOrEqual(source.height);
    }
  });

  it('ships a file for exactly the exercises whose image is set, and nothing else', () => {
    const onDisk = new Set(files.map((f) => f.replace(/\.webp$/, '')));
    const claimed = new Set(EXERCISES.filter((e) => e.image !== null).map((e) => e.id));
    expect([...onDisk].sort()).toEqual([...claimed].sort());
  });
});

describe('the grid detector, on its own', () => {
  it('finds the cells both sheets really have, and puts them in reading order', async () => {
    for (const sheet of SHEETS) {
      const cells = await detectCells(sheet, SOURCE_DIR);
      expect(cells.length, sheet.file).toBe(sheet.columns * sheet.rows);
      expect(cells.length, sheet.file).toBe(sheet.ids.length);
      for (const cell of cells) {
        expect(cell.width, sheet.file).toBeGreaterThanOrEqual(40);
        expect(cell.height, sheet.file).toBeGreaterThanOrEqual(60);
      }
      // Reading order: every cell in a row starts above every cell in the next.
      for (let r = 1; r < sheet.rows; r += 1) {
        const previous = cells.slice((r - 1) * sheet.columns, r * sheet.columns);
        const current = cells.slice(r * sheet.columns, (r + 1) * sheet.columns);
        const lowestAbove = Math.max(...previous.map((c) => c.top));
        const highestBelow = Math.min(...current.map((c) => c.top));
        expect(highestBelow, `${sheet.file} row ${r}`).toBeGreaterThan(lowestAbove);
      }
    }
  }, 30_000);

  it('throws rather than mis-slice when the grid is not the shape the mapping expects', async () => {
    const sheet = SHEETS[0];
    expect(sheet).toBeDefined();
    if (sheet === undefined) return;
    // A silent mis-slice ships the wrong movement on the wrong card, so a grid
    // that does not match what the ids expect has to stop the run.
    await expect(detectCells({ ...sheet, rows: sheet.rows + 1 }, SOURCE_DIR)).rejects.toThrow(/expected/);
    await expect(detectCells({ ...sheet, columns: sheet.columns + 1 }, SOURCE_DIR)).rejects.toThrow(/expected/);
  }, 30_000);
});

describe('the rule that decides which enclosed light regions are background', () => {
  /**
   * A drawing in miniature: white paper, a 2px ink outline, a flat fill inside,
   * and three light patches in it. Everything here is deliberately the same
   * SIZE, because size is exactly what the rule must not use — the old one did,
   * and it read a 0.10% pocket as clothing and shipped it white.
   */
  const W = 120;
  const H = 120;
  const WHITE = [255, 255, 255] as const;
  const INK = [20, 20, 20] as const;
  const SKIN = [249, 201, 151] as const;
  const GREY = [213, 212, 213] as const;

  function draw(): Buffer {
    const rgba = Buffer.alloc(W * H * 4);
    const put = (x: number, y: number, c: readonly [number, number, number]): void => {
      const i = (y * W + x) * 4;
      rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255;
    };
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) put(x, y, WHITE);
    // A limb: 2px of outline around a skin fill.
    for (let y = 20; y < 100; y += 1) {
      for (let x = 20; x < 100; x += 1) {
        const edge = x < 22 || x > 97 || y < 22 || y > 97;
        put(x, y, edge ? INK : SKIN);
      }
    }
    const block = (x0: number, y0: number, w: number, h: number, c: readonly [number, number, number]): void => {
      for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) put(x, y, c);
    };
    /** A patch of its own colour, outlined in ink the way everything in this style is. */
    const patch = (x0: number, y0: number, c: readonly [number, number, number]): void => {
      block(x0 - 2, y0 - 2, 12, 12, INK);
      block(x0, y0, 8, 8, c);
    };
    // A white sock: the colour of the paper, lying right against the outline, so
    // only the stroke stands between it and the outside.
    patch(22, 30, WHITE);
    block(20, 30, 2, 8, INK);   // the outline it lies against, unbroken
    // A pocket of background: same colour, same size, walled off by the limb.
    patch(56, 56, WHITE);
    // Something the figure wears that merely happens to be light: a grey stripe,
    // as deep inside as the pocket.
    patch(56, 80, GREY);
    return rgba;
  }

  function classify(): { sock: boolean; pocket: boolean; stripe: boolean } {
    const rgba = draw();
    const isLight = (i: number): boolean => {
      const r = rgba[i] ?? 0; const g = rgba[i + 1] ?? 0; const b = rgba[i + 2] ?? 0;
      return 0.299 * r + 0.587 * g + 0.114 * b >= 200;
    };
    const exterior = new Uint8Array(W * H);
    const stack: number[] = [];
    const push = (x: number, y: number): void => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const p = y * W + x;
      if (exterior[p] === 1 || !isLight(p * 4)) return;
      exterior[p] = 1;
      stack.push(p);
    };
    for (let x = 0; x < W; x += 1) { push(x, 0); push(x, H - 1); }
    for (let y = 0; y < H; y += 1) { push(0, y); push(W - 1, y); }
    while (stack.length > 0) {
      const p = stack.pop();
      if (p === undefined) break;
      const x = p % W;
      const y = (p - x) / W;
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    }
    const filled = new Set(enclosedBackground(isLight, rgba, exterior, W, H));
    return {
      sock: filled.has(33 * W + 25),
      pocket: filled.has(60 * W + 60),
      stripe: filled.has(84 * W + 60),
    };
  }

  it('fills the walled-off pocket', () => {
    expect(classify().pocket).toBe(true);
  });

  it('leaves the white that lies against the outline, however deep the pocket beside it is', () => {
    // The sock and the pocket are the same colour and exactly the same size. Only
    // where they sit tells them apart, which is the whole point of the change.
    expect(classify().sock).toBe(false);
  });

  it('leaves light clothing that is not the background colour, however far in it sits', () => {
    expect(classify().stripe).toBe(false);
  });
});
