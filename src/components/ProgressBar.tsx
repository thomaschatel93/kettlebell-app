/** How far through the workout, read at a glance from across the room. */
export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const done = max > 0 ? Math.min(Math.max(value, 0), max) : 0;
  const pct = max > 0 ? (done / max) * 100 : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={max}
      className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
    >
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
