/**
 * Slice the two illustration sheets in `media-source/` into one WebP per exercise.
 *
 * The two sheets differ in size, cell count, and whether the artist's printed
 * labels are present, so nothing here is computed from the image dimensions.
 * Everything is detected from the pixels:
 *
 *   - grid-01.png carries printed labels, and those labels sit BELOW their own
 *     cell's row boundary. A uniform 4x4 split drops each row's labels into the
 *     next row's tile, so a uniform split is never used.
 *   - grid-02.png has no labels at all, and the same detector handles it by
 *     simply finding no short bands to discard.
 *
 * Every detected grid is asserted against what the mapping expects, and a
 * mismatch throws. A silent mis-slice ships the wrong movement on the wrong
 * exercise card, which is the failure this whole step exists to prevent.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { CONTENT_MAX_LUMA, PADDING, writeCardWebp } from './lib/card-image.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'exercises');

/**
 * Bands closer together than this are one band. Kept small on purpose: on grid-01
 * a printed label sits only 13px under its own figure, so a generous gap would
 * bridge a whole row into the next one.
 */
const MERGE_GAP = 8;
/** Anything narrower than this in x is speckle, not a column of figures. */
const MIN_COLUMN_WIDTH = 40;
/** Anything shorter than this in y is a printed label, not a figure. */
const MIN_FIGURE_HEIGHT = 60;

interface Band {
  readonly start: number;
  readonly end: number;
}

export interface Cell {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Sheet {
  readonly file: string;
  readonly columns: number;
  readonly rows: number;
  /** Reading order, left to right then top to bottom. `null` means do not ship this cell. */
  readonly ids: readonly (string | null)[];
}

/**
 * grid-01, read left to right and top to bottom. The printed labels confirm the
 * order: Kettlebell Swing, Goblet Squat, Deadlift, Clean and Press / Front Lunge,
 * Sumo Deadlift, Single-Arm Swing, Overhead Press / Russian Twist, Step-Up,
 * Kettlebell Row, Front Raise / Kettlebell Snatch, Halo, Reverse Lunge,
 * Squat to Press. Front Raise is dropped: it is not real kettlebell programming.
 */
const GRID_01: Sheet = {
  file: 'grid-01.png',
  columns: 4,
  rows: 4,
  ids: [
    // Cell 1 was Two-Hand Swing, superseded: `two-hand-swing.webp` now ships from
    // `media-source/two-hand-swing-hinge-to-standing.png`, a proper 2-panel still
    // (hinge, then standing tall with the bell floated to chest height) instead
    // of this single frozen grid pose. Left null so this sheet can never
    // overwrite it back to the single-position version. See docs/media-map.md.
    //
    // Cell 4 is labelled Clean and Press, and it is not shippable: the figure
    // holds TWO bells, one pressed overhead and one in an ambiguous rack with
    // the elbow away from the ribs. `clean-and-press` is a one-bell, single-arm
    // lift whose cues say to spear one hand through the handle, so the picture
    // contradicts its own caption and the kit the app filtered for.
    null, 'goblet-squat', 'deadlift', null,
    // Cell 7 was Single-Arm Swing, superseded the same way as cell 1: it now
    // ships from `media-source/single-arm-swing-hinge-to-standing.png`, a
    // 2-panel still (hinge, then standing tall with the bell forward at chest
    // height, one hand). See docs/media-map.md.
    'front-lunge', 'sumo-deadlift', null, 'overhead-press',
    // Cell 12 is Front Raise, dropped: not real kettlebell programming.
    'russian-twist', 'step-up', 'bent-over-row', null,
    'snatch', 'halo', 'reverse-lunge', 'squat-to-press',
  ],
};

/** grid-02, read in the order the twelve cells were asked for in `docs/remaining-images-prompt.md`. */
const GRID_02: Sheet = {
  file: 'grid-02.png',
  columns: 4,
  rows: 3,
  ids: [
    // Cells 1 and 2 are the same rack from the side and the front, and only one
    // can be `clean`. The side view is the one that shows what the cue asks for:
    // forearm vertical against the ribs, elbow tucked, wrist straight. The front
    // view carries the bell across the chest on a diagonal forearm, so it goes.
    //
    // Cell 4 is drawn with BOTH hands on the handle and both elbows flared wide.
    // `high-pull` is unilateral, on one bell, and its cues say one hand on the
    // handle with the free arm out of the way. Same fault as the flagged clean:
    // a picture that contradicts its own caption.
    'clean', null, 'push-press', null,
    'racked-carry', 'goblet-carry', 'overhead-carry', 'bulgarian-split-squat',
    // Cell 11 is the floor pullover, and it is not shippable: both palms are
    // splayed flat on the round BALL of the bell with the handle hanging unused
    // below it. The exercise's own setup cue says to hold the bell by the horns
    // with both hands, and an earlier still was banned from the app for this
    // exact fault. See docs/media-map.md.
    'dead-row', 'half-kneeling-press', null, 'figure-8',
  ],
};

export const SHEETS: readonly Sheet[] = [GRID_01, GRID_02];

/** Group a run-length mask into bands, merging bands separated by a small gap. */
function bandsOf(mask: readonly boolean[], mergeGap: number): Band[] {
  const bands: Band[] = [];
  let start: number | null = null;
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] === true) {
      if (start === null) start = i;
    } else if (start !== null) {
      bands.push({ start, end: i - 1 });
      start = null;
    }
  }
  if (start !== null) bands.push({ start, end: mask.length - 1 });

  const merged: Band[] = [];
  for (const band of bands) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && band.start - previous.end <= mergeGap) {
      merged[merged.length - 1] = { start: previous.start, end: band.end };
    } else {
      merged.push(band);
    }
  }
  return merged;
}

/** Detect the cells of a sheet in reading order. Throws when the grid is not what the mapping expects. */
export async function detectCells(sheet: Sheet, sourceDir: string): Promise<Cell[]> {
  const source = path.join(sourceDir, sheet.file);
  const { data, info } = await sharp(source)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const content = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    content[i] = (data[i] ?? 255) < CONTENT_MAX_LUMA ? 1 : 0;
  }

  const columnMask: boolean[] = new Array<boolean>(width).fill(false);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (content[row + x] === 1) columnMask[x] = true;
    }
  }
  const columns = bandsOf(columnMask, MERGE_GAP)
    .filter((b) => b.end - b.start + 1 >= MIN_COLUMN_WIDTH);

  if (columns.length !== sheet.columns) {
    throw new Error(
      `${sheet.file}: detected ${columns.length} columns, expected ${sheet.columns}. ` +
      `Bands: ${columns.map((b) => `${b.start}-${b.end}`).join(', ')}`,
    );
  }

  /** cells[columnIndex][rowIndex] */
  const byColumn: Cell[][] = [];
  for (const column of columns) {
    const rowMask: boolean[] = new Array<boolean>(height).fill(false);
    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      for (let x = column.start; x <= column.end; x += 1) {
        if (content[row + x] === 1) { rowMask[y] = true; break; }
      }
    }
    const all = bandsOf(rowMask, MERGE_GAP);
    // The tall bands are figures. The short ones are the sheet's printed labels.
    const figures = all.filter((b) => b.end - b.start + 1 >= MIN_FIGURE_HEIGHT);

    if (figures.length !== sheet.rows) {
      throw new Error(
        `${sheet.file}: column ${column.start}-${column.end} yielded ${figures.length} figures, ` +
        `expected ${sheet.rows}. Bands: ${all.map((b) => `${b.start}-${b.end}(${b.end - b.start + 1}px)`).join(', ')}`,
      );
    }

    byColumn.push(figures.map((figure) => {
      // Tighten the crop horizontally against this figure alone. A column band is
      // as wide as its widest figure, and without this a tall standing figure
      // inherits the whitespace of the sprawling one three rows below it.
      let first = column.end;
      let last = column.start;
      for (let y = figure.start; y <= figure.end; y += 1) {
        const row = y * width;
        for (let x = column.start; x <= column.end; x += 1) {
          if (content[row + x] === 1) {
            if (x < first) first = x;
            if (x > last) last = x;
          }
        }
      }
      if (last < first) throw new Error(`${sheet.file}: empty figure band ${figure.start}-${figure.end}`);

      const left = Math.max(0, first - PADDING);
      const top = Math.max(0, figure.start - PADDING);
      return {
        left,
        top,
        width: Math.min(width - left, last - first + 1 + PADDING * 2),
        height: Math.min(height - top, figure.end - figure.start + 1 + PADDING * 2),
      };
    }));
  }

  // Detection walks columns; the mapping is in reading order.
  const cells: Cell[] = [];
  for (let r = 0; r < sheet.rows; r += 1) {
    for (let c = 0; c < sheet.columns; c += 1) {
      const cell = byColumn[c]?.[r];
      if (cell === undefined) throw new Error(`${sheet.file}: missing cell at row ${r}, column ${c}`);
      cells.push(cell);
    }
  }

  if (cells.length !== sheet.ids.length) {
    throw new Error(`${sheet.file}: ${cells.length} cells for ${sheet.ids.length} ids`);
  }
  return cells;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const sourceDir = path.join(ROOT, 'media-source');
  await mkdir(OUT_DIR, { recursive: true });

  for (const sheet of SHEETS) {
    const cells = await detectCells(sheet, sourceDir);
    console.log(`\n${sheet.file}: ${sheet.columns}x${sheet.rows}, ${cells.length} cells detected`);

    for (let i = 0; i < cells.length; i += 1) {
      const id = sheet.ids[i];
      const cell = cells[i];
      if (cell === undefined) continue;
      const where = `[${String(i + 1).padStart(2)}] ${cell.width}x${cell.height} at ${cell.left},${cell.top}`;
      if (id === null || id === undefined) {
        console.log(`${where}  not shipped (see the note beside this sheet's ids)`);
        continue;
      }
      if (dryRun) { console.log(`${where}  -> ${id}.webp (dry run)`); continue; }

      const out = path.join(OUT_DIR, `${id}.webp`);
      const result = await writeCardWebp(path.join(sourceDir, sheet.file), cell, out);
      console.log(`${where}  -> ${id}.webp (${result.width}x${result.height})`);
    }
  }
}

/**
 * Only slice when this file is the process entry point. Without the guard,
 * importing `detectCells` from a test rewrites every file in
 * `public/exercises/` as a side effect of the import.
 */
const entry = process.argv[1];
if (entry !== undefined && path.resolve(entry) === import.meta.filename) {
  await main();
}
