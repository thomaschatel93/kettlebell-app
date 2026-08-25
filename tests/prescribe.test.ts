import { describe, it, expect } from 'vitest';
import { prescribe, estimateWork, betweenRoundsRest } from '@/lib/prescribe';
import { ex, kit, FULL_KIT } from './fixtures';

const swing = ex('swing', { mechanic: 'ballistic', loadBand: 'heavy', secondsPerRep: 2, defaultReps: 10 });
const press = ex('press', { loadBand: 'light', secondsPerRep: 4, defaultReps: 10 });
const carry = ex('carry', {
  mechanic: 'carry', defaultReps: undefined, defaultWorkSeconds: 40, secondsPerRep: 0,
});

describe('prescribe', () => {
  it('uses the default reps at normal effort', () => {
    expect(prescribe(swing, 'circuit', 'normal', FULL_KIT)).toEqual({ reps: 10, restSeconds: 30 });
  });

  it('gives easy fewer reps and more rest', () => {
    expect(prescribe(swing, 'circuit', 'easy', FULL_KIT)).toEqual({ reps: 7, restSeconds: 45 });
  });

  it('gives hard more reps and less rest', () => {
    expect(prescribe(swing, 'circuit', 'hard', FULL_KIT)).toEqual({ reps: 12, restSeconds: 25 });
  });

  it('never drops below three reps', () => {
    expect(prescribe(ex('x', { defaultReps: 3 }), 'circuit', 'easy', FULL_KIT).reps).toBe(3);
  });

  it('prescribes five reps for strength before modifiers', () => {
    expect(prescribe(swing, 'strength', 'normal', FULL_KIT)).toEqual({ reps: 5, restSeconds: 90 });
  });

  it('prescribes carries in seconds, rounded to five', () => {
    expect(prescribe(carry, 'circuit', 'normal', FULL_KIT)).toEqual({ seconds: 40, restSeconds: 30 });
    expect(prescribe(carry, 'circuit', 'easy', FULL_KIT)).toEqual({ seconds: 30, restSeconds: 45 });
  });

  it('cuts the reps on a light grind when the kit cannot separate the load bands', () => {
    const oneBell = kit({ bells: [{ weightKg: 24, count: 1 }] });
    expect(prescribe(press, 'circuit', 'normal', oneBell).reps).toBe(6);
    // A heavy ballistic is unaffected: the one bell is the right bell for a swing.
    expect(prescribe(swing, 'circuit', 'normal', oneBell).reps).toBe(10);
  });
});

describe('estimateWork', () => {
  it('multiplies reps by the seconds per rep', () => {
    expect(estimateWork(swing, { reps: 10, restSeconds: 30 })).toBe(20);
  });

  it('does not double a unilateral movement, because it emits two steps', () => {
    expect(estimateWork(ex('u', { unilateral: true, secondsPerRep: 2, defaultReps: 10 }), { reps: 10, restSeconds: 30 })).toBe(20);
  });

  it('uses the seconds directly for a carry', () => {
    expect(estimateWork(carry, { seconds: 40, restSeconds: 30 })).toBe(40);
  });
});

describe('betweenRoundsRest', () => {
  it('gives strength a real rest between rounds', () => {
    expect(betweenRoundsRest('strength', 'normal')).toBe(90);
  });

  it('rests longer between complex rounds than circuit rounds', () => {
    expect(betweenRoundsRest('circuit', 'normal')).toBe(75);
    expect(betweenRoundsRest('complex', 'normal')).toBe(90);
  });

  it('applies the effort modifier', () => {
    expect(betweenRoundsRest('circuit', 'easy')).toBe(115);
    expect(betweenRoundsRest('circuit', 'hard')).toBe(60);
  });
});
