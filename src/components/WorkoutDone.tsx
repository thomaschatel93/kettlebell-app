'use client';

import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { mmss } from '@/lib/clock';
import { loadHistory } from '@/lib/storage';
import type { HistoryEntry } from '@/lib/types';

/**
 * The stub end screen: what he just did, and a way home. Task 21 finishes it.
 *
 * The newest entry is read through `useSyncExternalStore` rather than an
 * effect, for the reason set out in `local-store.ts`: localStorage does not
 * exist during the server render, and hydrating from it in an effect is
 * rejected outright by Next 16's React Compiler ruleset.
 */
const NOTHING_YET = Symbol('history not read');

let snapshot: HistoryEntry | null | typeof NOTHING_YET = NOTHING_YET;

/**
 * The commit is the first moment localStorage may be read. React re-checks the
 * snapshot immediately after `subscribe` returns, so refreshing here is enough
 * to pull the stored value in - with no setState, and no notification fired
 * mid-subscribe.
 */
const subscribe = (): (() => void) => {
  snapshot = loadHistory()[0] ?? null;
  return () => {};
};

const getSnapshot = (): HistoryEntry | null | typeof NOTHING_YET => snapshot;
const getServerSnapshot = (): typeof NOTHING_YET => NOTHING_YET;

export function WorkoutDone() {
  const router = useRouter();
  const newest = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <>
      <h1 className="text-4xl font-bold tracking-tight">Done.</h1>

      <Card className="flex flex-col gap-2">
        <p className="text-base font-medium text-[var(--text-dim)]">Time worked</p>
        <p className="text-6xl font-bold leading-none tabular-nums tracking-tight">
          {newest === NOTHING_YET || newest === null ? '—' : mmss(newest.workedSeconds)}
        </p>
      </Card>

      <Button onClick={() => router.push('/')}>Home</Button>
    </>
  );
}
