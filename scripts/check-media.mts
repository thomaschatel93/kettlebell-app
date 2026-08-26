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

const singles = withImage.filter((e) => e.imagePanels === 1 && e.mechanic === 'ballistic');
if (singles.length > 0) {
  console.log(`\n${singles.length} ballistics ship as a single position and would read better with more:`);
  for (const e of singles) console.log(`  ${e.id}`);
}

if (broken.length > 0) process.exitCode = 1;
