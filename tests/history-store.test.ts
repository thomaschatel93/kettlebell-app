import { describe, it, expect, beforeEach } from 'vitest';
import { appendHistory, getHistorySnapshot } from '@/lib/history-store';
import { MAX_HISTORY, loadHistory } from '@/lib/storage';
import { entry } from './fixtures';

beforeEach(() => localStorage.clear());

describe('appendHistory', () => {
  it('writes through to storage, newest first', () => {
    appendHistory(entry({ id: 'one' }));
    appendHistory(entry({ id: 'two' }));
    expect(loadHistory().map((e) => e.id)).toEqual(['two', 'one']);
  });

  /**
   * The write drops the thirty-first entry. Without the same cut on the
   * snapshot, every mounted screen keeps counting it until a reload - so Home's
   * all-time total reads one higher than the app would find on next open.
   */
  it('caps the in-memory snapshot at the number storage actually keeps', () => {
    for (let i = 0; i <= MAX_HISTORY; i++) appendHistory(entry({ id: `e${i}` }));
    expect(loadHistory()).toHaveLength(MAX_HISTORY);
    expect(getHistorySnapshot()).toHaveLength(MAX_HISTORY);
    expect(loadHistory()[0].id).toBe(`e${MAX_HISTORY}`);
  });
});
