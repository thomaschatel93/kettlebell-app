/**
 * Import the individual 1024x1024 stills in `media-source/`.
 *
 * The mapping is read out of `docs/media-map.md`, which is the source of truth
 * for which file shows which exercise. Nothing is hard-coded here, including the
 * do-not-ship list: that is parsed from the document's own "Do not ship"
 * section, so the document and the pipeline cannot drift apart.
 *
 * Only high-confidence rows are imported. Everything else is skipped and the
 * reason printed, because a missing picture costs nothing and a wrong one
 * teaches an injury.
 */
import { mkdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { EXERCISES } from '../src/lib/data/exercises.ts';
import { contentRegion, writeCardWebp } from './lib/card-image.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'media-source');
const OUT_DIR = path.join(ROOT, 'public', 'exercises');
const MAP = path.join(ROOT, 'docs', 'media-map.md');

interface Row {
  readonly file: string;
  readonly id: string | null;
  readonly confidence: string;
}

/** The filenames the map's "Do not ship" section names, with the reason given. */
function parseDoNotShip(markdown: string): Map<string, string> {
  const section = markdown.split(/^## Do not ship\s*$/m)[1] ?? '';
  const banned = new Map<string, string>();
  for (const line of section.split('\n')) {
    const match = /^\s*-\s+\*\*`([^`]+)`\*\*\s*(.*)$/.exec(line);
    if (match === null) continue;
    const [, file, reason] = match;
    if (file === undefined) continue;
    banned.set(file, (reason ?? '').replace(/^[^A-Za-z]*/, '').trim());
  }
  return banned;
}

/** The map's table rows: filename, the exercise id claimed for it, and the confidence. */
function parseRows(markdown: string, knownIds: ReadonlySet<string>): Row[] {
  const rows: Row[] = [];
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const [, fileCell, idCell, confidenceCell] = cells;
    if (fileCell === undefined || idCell === undefined || confidenceCell === undefined) continue;
    const file = /^`([^`]+)`$/.exec(fileCell)?.[1];
    if (file === undefined || !file.endsWith('.png')) continue;
    const claimed = /`([^`]+)`/.exec(idCell)?.[1] ?? null;
    rows.push({
      file,
      id: claimed !== null && knownIds.has(claimed) ? claimed : null,
      confidence: confidenceCell,
    });
  }
  return rows;
}

async function exists(file: string): Promise<boolean> {
  try { await access(file); return true; } catch { return false; }
}

async function main(): Promise<void> {
  const markdown = await readFile(MAP, 'utf8');
  const knownIds = new Set(EXERCISES.map((e) => e.id));
  const banned = parseDoNotShip(markdown);
  const rows = parseRows(markdown, knownIds);
  if (rows.length === 0) throw new Error(`${MAP}: no mapping rows parsed`);

  await mkdir(OUT_DIR, { recursive: true });
  const skipped: string[] = [];
  let imported = 0;

  for (const row of rows) {
    const label = row.file;
    if (banned.has(row.file)) {
      skipped.push(`${label}: do not ship — ${banned.get(row.file) ?? 'flagged in docs/media-map.md'}`);
      continue;
    }
    if (row.id === null) {
      skipped.push(`${label}: no exercise id in docs/media-map.md, or the id is not one of the ${knownIds.size} exercises`);
      continue;
    }
    if (!/^high$/i.test(row.confidence)) {
      skipped.push(`${label}: confidence "${row.confidence}" for ${row.id}, only high-confidence stills are imported`);
      continue;
    }
    const out = path.join(OUT_DIR, `${row.id}.webp`);
    if (await exists(out)) {
      skipped.push(`${label}: ${row.id}.webp already came off a grid sheet, not overwriting`);
      continue;
    }
    const source = path.join(SOURCE_DIR, row.file);
    if (!await exists(source)) {
      skipped.push(`${label}: file is not in media-source/`);
      continue;
    }
    const region = await contentRegion(source);
    const result = await writeCardWebp(source, region, out);
    imported += 1;
    console.log(`imported ${row.id}.webp (${result.width}x${result.height}) from ${row.file}`);
  }

  console.log(`\n${imported} imported, ${skipped.length} skipped:`);
  for (const line of skipped) console.log(`  - ${line}`);
}

await main();
