'use client';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { mmss } from '@/lib/clock';

/**
 * The rest between two efforts.
 *
 * The one thing this card must never do is disappear at zero. The number he
 * wants is how long he has actually been resting, and throwing it away the
 * instant the countdown runs out discards the thing he was looking at the
 * screen for. So past zero the reading keeps going, upward, and says how far
 * over he is.
 *
 * `remainingSeconds` is handed in already derived from an absolute deadline, so
 * this component holds no timer of its own and cannot drift.
 */
export function RestCard({
  remainingSeconds,
  nextName,
  onSkip,
  onAddTime,
}: {
  remainingSeconds: number;
  nextName: string;
  onSkip: () => void;
  onAddTime: () => void;
}) {
  const over = remainingSeconds < 0;

  return (
    <Card className="flex flex-col items-center gap-5 text-center">
      <h1 className="text-2xl font-bold uppercase tracking-widest text-[var(--text)]">Rest</h1>

      {/*
        One element, one string. Splitting "Over by" off into its own line would
        read as two separate facts from across the room; at a metre it has to
        land as a single reading.
      */}
      {over ? (
        <p className="text-5xl font-bold leading-none tabular-nums tracking-tight text-[var(--accent)]">
          {`Over by ${mmss(remainingSeconds)}`}
        </p>
      ) : (
        <p className="text-8xl font-bold leading-none tabular-nums tracking-tight text-[var(--text)]">
          {mmss(remainingSeconds)}
        </p>
      )}

      <p className="text-xl font-bold leading-snug text-[var(--text)]">{`Next: ${nextName}`}</p>

      {/*
        More rest as well as less. A rest that can only be cut short is a rest
        that quietly tells him he is behind; some days the honest answer is
        another thirty seconds.
      */}
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Button variant="ghost" onClick={onAddTime}>
          +30s
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip rest
        </Button>
      </div>
    </Card>
  );
}
