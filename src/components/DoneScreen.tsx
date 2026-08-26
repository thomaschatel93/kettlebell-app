'use client';

import Link from 'next/link';
import { buttonClass } from '@/components/Button';
import { Card } from '@/components/Card';
import { PatternTag } from '@/components/Chip';
import { Option } from '@/components/Option';
import { isHistoryHydrated, rateEntry, useHistory } from '@/lib/history-store';
import { FELT_LABEL, dayText, exerciseNames, formatLabel, minutesText, patternsOf } from '@/lib/session';
import type { HistoryEntry } from '@/lib/types';

const FELTS: NonNullable<HistoryEntry['felt']>[] = ['easy', 'right', 'brutal'];

/**
 * What he just did, and the one question worth asking while he is still
 * breathing hard.
 *
 * Two things earn their place on this screen and nothing else does.
 *
 * The estimate comparison - "34 min, estimated 30" - is the only mechanism in
 * the whole app by which a wrong `secondsPerRep` in the exercise database ever
 * gets noticed. Nobody is going to audit that table; a session that keeps
 * running twenty minutes past its estimate says the table is wrong, and this
 * line is the only place that ever surfaces it.
 *
 * The effort rating is one tap, with the workout already over, on a control
 * sized for a shaking hand. That is the cheapest logging there is, and it is the
 * input that would let effort selection get smarter later. Per-set rep and
 * weight logging is deliberately not here: it is four screens of admin between a
 * man and a shower, and he would stop doing it inside a fortnight.
 */
export function DoneScreen() {
  const history = useHistory();
  const newest = isHistoryHydrated(history) ? (history[0] ?? null) : undefined;

  if (newest === undefined) {
    return (
      <>
        <h1 className="text-4xl font-bold tracking-tight">Done.</h1>
        <p className="text-sm text-[var(--text-dim)]">Reading your session…</p>
      </>
    );
  }

  if (newest === null) {
    return (
      <>
        <h1 className="text-4xl font-bold tracking-tight">Done.</h1>
        <Card className="flex flex-col gap-3">
          <p className="text-base font-bold">Nothing to show.</p>
          <p className="text-sm text-[var(--text-dim)]">
            No finished session is stored, so there is nothing to rate. Nothing was lost.
          </p>
        </Card>
        <Link href="/workout" className={buttonClass()}>Set one up</Link>
      </>
    );
  }

  const estimated = newest.workout?.estimatedSeconds;
  const showEstimate = typeof estimated === 'number' && Number.isFinite(estimated) && estimated > 0;
  const moves = exerciseNames(newest);
  const patterns = patternsOf(newest);

  return (
    <>
      <header>
        <h1 className="text-4xl font-bold tracking-tight">Done.</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          {`${formatLabel(newest)} · ${dayText(newest.createdAt)}`}
        </p>
      </header>

      <Card className="flex flex-col gap-1">
        <p className="text-base font-medium text-[var(--text-dim)]">Time worked</p>
        <p className="text-6xl font-bold leading-none tabular-nums tracking-tight">
          {minutesText(newest.workedSeconds)}
        </p>
        {/*
          Said plainly, both ways round. A session that runs long is not a
          failure and a short one is not cheating - the number that is wrong is
          usually the estimate, and this is the only place that ever says so.
        */}
        {showEstimate && (
          <p className="mt-1 text-base font-medium text-[var(--text-dim)]">
            {`estimated ${minutesText(estimated)}`}
          </p>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold tracking-tight">How did that feel?</h2>
        <div className="grid grid-cols-3 gap-3">
          {FELTS.map((felt) => (
            <Option
              key={felt}
              selected={newest.felt === felt}
              onClick={() => rateEntry(newest.id, felt)}
            >
              {FELT_LABEL[felt]}
            </Option>
          ))}
        </div>
        <p className="text-sm text-[var(--text-dim)]">
          One tap. It is the only thing the app asks you to log.
        </p>
      </section>

      {moves.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-bold tracking-tight">What you did</h2>
          <ul className="flex flex-col gap-1.5">
            {moves.map((name) => (
              <li key={name} className="text-base font-medium leading-tight">{name}</li>
            ))}
          </ul>
          {patterns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {patterns.map((p) => (
                <PatternTag key={p} tone={p}>{p[0].toUpperCase() + p.slice(1)}</PatternTag>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <Link href="/history" className={buttonClass('ghost')}>See your history</Link>
        <Link href="/" className={buttonClass()}>Home</Link>
      </div>
    </>
  );
}
