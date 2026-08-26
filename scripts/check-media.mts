/**
 * What still has no picture. Run it with `npm run media:todo`.
 *
 * The outstanding work should always be one command away, and it should come
 * from the data rather than from a list someone has to remember to update.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { EXERCISES } from '../src/lib/data/exercises.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

const withImage = EXERCISES.filter((e) => e.image !== null);
const missing = EXERCISES.filter((e) => e.image === null);

console.log(`${withImage.length} of ${EXERCISES.length} exercises have an image.`);

const broken = withImage.filter((e) => !existsSync(path.join(ROOT, 'public', e.image ?? '')));
if (broken.length > 0) {
  console.log(`\n${broken.length} point at a file that is not there:`);
  for (const e of broken) console.log(`  ${e.id} -> ${e.image ?? ''}`);
}

if (missing.length === 0) {
  console.log('\nNothing outstanding.');
} else {
  console.log(`\n${missing.length} still need one:`);
  for (const e of missing) {
    console.log(`  ${e.id.padEnd(24)} ${e.imagePanels} panel${e.imagePanels === 1 ? '' : 's'} needed`);
  }
}

/**
 * What each movement needs before its picture teaches the whole thing. A
 * ballistic shown as one frozen position does not teach the swing that gets it
 * there, and the Turkish get-up's six positions want three panels.
 *
 * This is checked against images that EXIST, not only against missing ones. A
 * shortfall on a file that ships is exactly the kind of gap that goes unrecorded
 * otherwise: the tile is there, so nothing complains, and the fact that it shows
 * half the movement lives only in a report nobody greps.
 */
const PANELS_WANTED: ReadonlyMap<string, number> = new Map([
  ['turkish-get-up', 3],
]);

const wanted = (id: string, mechanic: string): number => PANELS_WANTED.get(id)
  ?? (mechanic === 'ballistic' ? 2 : 1);

const short = withImage
  .map((e) => ({ e, need: wanted(e.id, e.mechanic) }))
  .filter(({ e, need }) => e.imagePanels < need);

if (short.length > 0) {
  console.log(`\n${short.length} ship a picture with too few panels:`);
  for (const { e, need } of short) {
    console.log(`  ${e.id.padEnd(24)} has ${e.imagePanels}, wants ${need}`);
  }
}

if (broken.length > 0) process.exitCode = 1;
