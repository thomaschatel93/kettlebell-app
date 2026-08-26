const SIZE = 132;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A count drawn as an arc, starting at twelve o'clock. Used on Home and
 * History, where the screen is read close up.
 *
 * The whole thing is one image to assistive technology: the arc says nothing
 * on its own, so the label carries the count instead.
 */
export function Ring({
  value,
  max,
  label,
  caption,
}: {
  value: number;
  max: number;
  label: string;
  caption?: string;
}) {
  const done = max > 0 ? Math.min(Math.max(value, 0), max) : 0;
  const fraction = max > 0 ? done / max : 0;

  return (
    <div
      role="img"
      aria-label={`${label}: ${value} of ${max}`}
      className="relative inline-flex shrink-0"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg aria-hidden="true" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={STROKE}
        />
        {fraction > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold leading-none tabular-nums text-[var(--text)]">{done}</span>
        {caption && <span className="mt-1.5 text-xs font-medium text-[var(--text-dim)]">{caption}</span>}
      </div>
    </div>
  );
}
