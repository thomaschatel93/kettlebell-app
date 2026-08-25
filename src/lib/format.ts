import type { Format, WorkoutRequest } from '@/lib/types';

export function chooseFormat(req: WorkoutRequest, combosAvailable: boolean): Format {
  if (req.format !== 'auto') return req.format;
  if (req.patterns.length >= 4) return 'circuit';
  if (req.totalMinutes >= 35) return 'strength';
  return combosAvailable ? 'complex' : 'circuit';
}
