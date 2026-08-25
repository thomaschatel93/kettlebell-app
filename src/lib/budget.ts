const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function budget(totalMinutes: number): {
  warmupSeconds: number; mainSeconds: number; cooldownSeconds: number;
} {
  const total = totalMinutes * 60;
  const warmupSeconds = clamp(Math.round(total * 0.15), 180, 420);
  const cooldownSeconds = clamp(Math.round(total * 0.1), 120, 300);
  return { warmupSeconds, cooldownSeconds, mainSeconds: total - warmupSeconds - cooldownSeconds };
}
