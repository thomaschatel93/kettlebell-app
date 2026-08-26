import { describe, it, expect } from 'vitest';
import { dayKey, entriesThisWeek, minutesOf, trainedOnEachDay, weekDays } from '@/lib/week';
import { entry } from './fixtures';

const at = (daysAgo: number, hour = 12): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const now = Date.now();

describe('weekDays', () => {
  it('is seven days, oldest first, ending today', () => {
    const days = weekDays(now);
    expect(days).toHaveLength(7);
    expect(dayKey(days[6])).toBe(dayKey(new Date(now)));
  });

  it('starts each day at midnight, so a dot means a day and not a moment', () => {
    for (const d of weekDays(now)) expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });

  it('crosses a month boundary without producing a zeroth of the month', () => {
    const days = weekDays(new Date(2026, 2, 3, 9).getTime());   // 3 March 2026
    expect(days.map(dayKey)).toEqual([
      '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28',
      '2026-03-01', '2026-03-02', '2026-03-03',
    ]);
  });
});

describe('entriesThisWeek', () => {
  it('counts today and six days back', () => {
    const h = [entry({ id: 'a', createdAt: at(0) }), entry({ id: 'b', createdAt: at(6) })];
    expect(entriesThisWeek(h, now)).toHaveLength(2);
  });

  it('drops anything older than the window', () => {
    expect(entriesThisWeek([entry({ createdAt: at(10) })], now)).toHaveLength(0);
  });

  /** An entry that cannot be placed on a day must not land on today's by default. */
  it('drops an unreadable date rather than counting it as today', () => {
    expect(entriesThisWeek([entry({ createdAt: 'not a date' })], now)).toHaveLength(0);
  });
});

describe('trainedOnEachDay', () => {
  it('is one flag per day, oldest first', () => {
    const flags = trainedOnEachDay([entry({ createdAt: at(0) })], now);
    expect(flags).toHaveLength(7);
    expect(flags[6]).toBe(true);
    expect(flags.filter(Boolean)).toHaveLength(1);
  });

  it('lights a day once however many sessions it held', () => {
    const h = [entry({ id: 'a', createdAt: at(2, 8) }), entry({ id: 'b', createdAt: at(2, 19) })];
    expect(trainedOnEachDay(h, now).filter(Boolean)).toHaveLength(1);
  });
});

describe('minutesOf', () => {
  it('rounds once at the end rather than per entry', () => {
    // 50s + 50s is two minutes to the nearest minute, not zero.
    expect(minutesOf([entry({ id: 'a', workedSeconds: 50 }), entry({ id: 'b', workedSeconds: 50 })])).toBe(2);
  });
});
