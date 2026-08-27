/**
 * The two countdown cues, generated rather than sourced.
 *
 * Sound is the only output channel that reaches him. The phone is a metre away
 * on a garage floor, music is playing, and he is mid-plank with his eyes shut -
 * so a cue that merely exists is not a cue. The first pair failed on three
 * counts at once and this script fixes all three:
 *
 * 1. LEVEL. They peaked at -18.5 dBFS, throwing away eighteen decibels of
 *    headroom, and the player then multiplied by 0.8 for another 1.9 dB on top.
 *    Everything here is normalised to a fixed peak, measured rather than
 *    assumed, so "louder" is a number in this file and not a guess.
 * 2. FREQUENCY. 880 Hz sits in the middle of where music keeps its energy, so
 *    the tick was masked by the very thing it had to be heard over. The tick
 *    now sits at 2.1 kHz with its octave on top, which is close to where the
 *    ear is most sensitive and above most of what a speaker is already playing.
 * 3. ATTACK. A sine faded in over tens of milliseconds is a swell, and a swell
 *    is what the ear discards first in noise. Each cue now starts with a two
 *    millisecond ramp - long enough not to pop, short enough to read as a
 *    strike - and a filtered noise transient rides the front of the tick to
 *    give it an edge a pure tone cannot have.
 *
 * The two must also stay clearly DIFFERENT, because the tone at zero means
 * something the ticks do not. They are separated on both axes a listener
 * actually uses: pitch (2.1 kHz against 1.32 kHz) and, more importantly,
 * duration - a 110 ms click against a 550 ms sustained chime, five times the
 * length. Either difference alone would carry it; together they cannot be
 * confused across a room with music playing.
 *
 * Run with `npm run audio`. The output is committed, so this runs when the cues
 * change and never at build time.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

/**
 * The peak every cue is normalised to, in dBFS.
 *
 * Not 0: an MP3 decoder can overshoot the sample values it was given by a
 * fraction of a decibel, and a cue that clips on a phone speaker is a cue that
 * rattles instead of sounding. One decibel of margin costs nothing audible and
 * removes the whole failure.
 */
const PEAK_DBFS = -1;

const RATE = 44_100;
const OUT_DIR = path.resolve(process.cwd(), 'public', 'audio');

const ffmpeg = (args: string[]): string => {
  try {
    return execFileSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const e = error as { stderr?: string; message: string };
    throw new Error(`ffmpeg failed:\n${e.stderr ?? e.message}`);
  }
};

/**
 * The measured peak of a rendered file, in dBFS.
 *
 * `volumedetect` reports on stderr, not stdout, which is why this reaches for
 * spawnSync rather than the helper above: execFileSync hands back stdout alone
 * and would find nothing to match.
 */
function peakDbfs(file: string): number {
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostdin', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const m = /max_volume:\s*(-?[\d.]+) dB/.exec(`${r.stdout ?? ''}${r.stderr ?? ''}`);
  if (m === null) throw new Error(`no max_volume in ffmpeg output for ${file}`);
  return Number(m[1]);
}

interface Cue {
  name: string;
  /** The lavfi sources mixed together, and the weight each carries. */
  parts: { source: string; weight: number }[];
  seconds: number;
  /** Where the decay starts and how long it takes. */
  fadeFrom: number;
  fadeFor: number;
}

/**
 * The tick: short, high and struck.
 *
 * The noise burst is two thirds of a hundredth of a second of band-passed hiss
 * sitting under the fundamental. On its own it is inaudible; under the tone it
 * is the difference between a beep and a click, and a click survives a room
 * with a speaker in it.
 */
const TICK: Cue = {
  name: 'tick',
  parts: [
    { source: `sine=frequency=2100:duration=0.11:sample_rate=${RATE}`, weight: 1 },
    { source: `sine=frequency=4200:duration=0.11:sample_rate=${RATE}`, weight: 0.38 },
    {
      source: `anoisesrc=color=white:duration=0.11:sample_rate=${RATE}:amplitude=1`,
      weight: 0.22,
    },
  ],
  seconds: 0.11,
  fadeFrom: 0.055,
  fadeFor: 0.055,
};

/**
 * The tone at zero: long, lower and sustained.
 *
 * A fifth above the fundamental, plus a quiet octave, so it reads as a chime
 * rather than a test tone - a small amount of harmonic content is what makes a
 * sound locate itself in a room instead of sitting flat behind the music.
 */
const GO: Cue = {
  name: 'go',
  parts: [
    { source: `sine=frequency=1320:duration=0.55:sample_rate=${RATE}`, weight: 1 },
    { source: `sine=frequency=1980:duration=0.55:sample_rate=${RATE}`, weight: 0.5 },
    { source: `sine=frequency=2640:duration=0.55:sample_rate=${RATE}`, weight: 0.2 },
  ],
  seconds: 0.55,
  fadeFrom: 0.16,
  fadeFor: 0.39,
};

function build(cue: Cue, work: string): void {
  const raw = path.join(work, `${cue.name}.wav`);
  const inputs = cue.parts.flatMap((p) => ['-f', 'lavfi', '-i', p.source]);
  const weights = cue.parts.map((p) => p.weight).join(' ');

  const chain = [
    // `normalize=0` keeps the weights as written rather than having amix scale
    // them back down to unity, which is what silently re-flattened the mix.
    `amix=inputs=${cue.parts.length}:weights=${weights}:normalize=0`,
    // The tick's noise is band-passed to sit with the tone rather than hiss
    // across the whole spectrum; harmless on a cue with no noise in it.
    'highpass=f=1400',
    'lowpass=f=9000',
    // Two milliseconds: too fast to hear as a swell, slow enough not to pop.
    'afade=t=in:st=0:d=0.002:curve=exp',
    `afade=t=out:st=${cue.fadeFrom}:d=${cue.fadeFor}:curve=exp`,
  ].join(',');

  ffmpeg([...inputs, '-filter_complex', chain, '-ac', '1', '-ar', String(RATE), raw]);

  // Measured, then corrected. Guessing the gain is how the last pair ended up
  // eighteen decibels down without anyone noticing.
  const gain = PEAK_DBFS - peakDbfs(raw);
  const out = path.join(OUT_DIR, `${cue.name}.mp3`);
  ffmpeg([
    '-i', raw,
    '-af', `volume=${gain.toFixed(2)}dB`,
    '-c:a', 'libmp3lame', '-b:a', '192k', '-ac', '1', '-ar', String(RATE),
    out,
  ]);

  const after = peakDbfs(out);
  console.log(
    `${cue.name}.mp3  ${cue.seconds.toFixed(3)}s  ` +
      `${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB applied  peak ${after.toFixed(1)} dBFS`,
  );
}

const work = path.join(tmpdir(), `kb-cues-${process.pid}`);
mkdirSync(work, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });
try {
  for (const cue of [TICK, GO]) build(cue, work);
} finally {
  rmSync(work, { recursive: true, force: true });
}
