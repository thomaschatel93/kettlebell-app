import type { Combo, Exercise, HistoryEntry, Pattern, WorkoutRequest } from '@/lib/types';
import type { Rng } from '@/lib/rng';

const RECENT_WORKOUTS = 2;

/**
 * Compared against mainExerciseIds, which is what the runner writes for the main
 * block only. Comparing against every id, warm-up included, would make this rule
 * dead code, because the arrays could never match.
 *
 * history is expected newest first. Storage prepends each new entry, so slicing the
 * head takes the two most recent workouts. That is the contract, hence no sort here.
 */
export function historyWeight(id: string, history: HistoryEntry[]): number {
  const recent = history.slice(0, RECENT_WORKOUTS).flatMap((h) => h.mainExerciseIds);
  return recent.includes(id) ? 0.25 : 1;
}

/**
 * Argmax over per-item noise, not a probabilistic draw. Fresh scores land in
 * [0.5, 1.5) and recently used in [0.125, 0.375), so the ranges never overlap and
 * a fresh candidate always wins. The rng only separates equals.
 */
export function weightedPick<T extends { id: string }>(
  rng: Rng, items: T[], history: HistoryEntry[],
): T | undefined {
  let best: T | undefined;
  let bestScore = -1;
  for (const item of items) {
    const s = historyWeight(item.id, history) * (0.5 + rng());
    if (s > bestScore) { bestScore = s; best = item; }
  }
  return best;
}

const mechanicRank = (e: Exercise): number => {
  if (e.mechanic === 'ballistic') return 0;
  if (e.mechanic === 'carry' || e.patterns[0] === 'core') return 2;
  return 1;
};

const MAX_SEARCH_ITEMS = 12;

/**
 * Largest-remaining-group greedy: always take from the largest group whose pattern
 * is not the previous one, ties broken on mechanic rank, which keeps ballistics
 * early without letting that override the adjacency rule. Complete for a straight
 * line, so it is the fallback for a set that admits no circular ordering at all.
 */
function greedyOrder(items: Exercise[]): Exercise[] {
  const groups = new Map<Pattern, Exercise[]>();
  for (const e of [...items].sort((a, b) => mechanicRank(a) - mechanicRank(b))) {
    const key = e.patterns[0];
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const out: Exercise[] = [];
  let last: Pattern | null = null;

  while (out.length < items.length) {
    const available = [...groups.entries()].filter(([, v]) => v.length > 0);
    const eligible = available.filter(([k]) => k !== last);
    const ranked = (eligible.length ? eligible : available).sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return mechanicRank(a[1][0]) - mechanicRank(b[1][0]);
    });
    const [key, list] = ranked[0];
    out.push(list.shift()!);
    last = key;
  }

  return out;
}

/**
 * The same greedy, made complete for the circle by backtracking when a branch dead
 * ends. The wrap-around matters because a circuit repeats: the last item of a round
 * is adjacent to the first item of the next, so the final slot also has to dodge the
 * opening pattern. A rotation cannot repair that, since rotating preserves every
 * circular adjacency and only moves a clashing pair from the wrap into the interior.
 *
 * Two things keep the search cheap. Items sharing a pattern are interchangeable, so
 * only the first unused one of each group is tried, which caps the branching factor
 * at the number of patterns. And states that dead end are remembered. Branches are
 * explored largest group first, ties on mechanic rank, so the first ordering found
 * is the one the greedy would have wanted.
 */
function searchOrder(items: Exercise[]): Exercise[] | null {
  const base = [...items].sort((a, b) => mechanicRank(a) - mechanicRank(b));
  const n = base.length;
  const used = new Array<boolean>(n).fill(false);
  const out: Exercise[] = [];
  const dead = new Set<string>();

  const step = (depth: number, last: Pattern | null, first: Pattern | null): boolean => {
    if (depth === n) return true;
    const key = `${used.map((u) => (u ? 1 : 0)).join('')}|${last}|${first}`;
    if (dead.has(key)) return false;

    const heads = new Map<Pattern, { index: number; count: number }>();
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const p = base[i].patterns[0];
      const seen = heads.get(p);
      if (seen) seen.count += 1;
      else heads.set(p, { index: i, count: 1 });
    }

    const candidates = [...heads.entries()]
      .filter(([p]) => p !== last && !(depth === n - 1 && p === first))
      .sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        return mechanicRank(base[a[1].index]) - mechanicRank(base[b[1].index]);
      });

    for (const [p, head] of candidates) {
      used[head.index] = true;
      out.push(base[head.index]);
      if (step(depth + 1, p, first ?? p)) return true;
      out.pop();
      used[head.index] = false;
    }

    dead.add(key);
    return false;
  };

  return step(0, null, null) ? [...out] : null;
}

/**
 * Returns an ordering with no two neighbours sharing a primary pattern, the circuit's
 * wrap-around included, whenever one exists. When none does, every item still comes
 * back, in the best order the greedy can manage.
 */
export function orderCircuit(items: Exercise[]): Exercise[] {
  if (items.length > MAX_SEARCH_ITEMS) return greedyOrder(items);
  return searchOrder(items) ?? greedyOrder(items);
}

export function selectCircuit(
  pool: Exercise[], req: WorkoutRequest, rng: Rng, history: HistoryEntry[], count: number,
): Exercise[] {
  const chosen: Exercise[] = [];
  const taken = new Set<string>();

  // One dedicated slot per requested pattern, in the order they were selected.
  for (const pattern of req.patterns) {
    if (chosen.length >= count) break;
    const primary = pool.filter((e) => !taken.has(e.id) && e.patterns[0] === pattern);
    const secondary = pool.filter((e) => !taken.has(e.id) && e.patterns.includes(pattern));
    const picked = weightedPick(rng, primary.length ? primary : secondary, history);
    if (picked) { chosen.push(picked); taken.add(picked.id); }
  }

  // Fill the rest, preferring whichever primary pattern is least represented, so
  // the set stays orderable rather than collapsing into four hinges.
  while (chosen.length < count) {
    const remaining = pool.filter((e) => !taken.has(e.id));
    if (remaining.length === 0) break;
    const used = new Map<Pattern, number>();
    for (const e of chosen) used.set(e.patterns[0], (used.get(e.patterns[0]) ?? 0) + 1);
    const fewest = Math.min(...remaining.map((e) => used.get(e.patterns[0]) ?? 0));
    const candidates = remaining.filter((e) => (used.get(e.patterns[0]) ?? 0) === fewest);
    const picked = weightedPick(rng, candidates, history);
    if (!picked) break;
    chosen.push(picked); taken.add(picked.id);
  }

  return orderCircuit(chosen);
}

export function selectStrength(
  pool: Exercise[], rng: Rng, history: HistoryEntry[], count: number,
): Exercise[] {
  const grinds = pool.filter((e) => e.mechanic === 'grind');
  const primary = weightedPick(rng, grinds.length ? grinds : pool, history);
  if (!primary) return [];

  const chosen = [primary];
  const taken = new Set([primary.id]);
  const usedPatterns = new Set<Pattern>([primary.patterns[0]]);

  while (chosen.length < count) {
    const remaining = pool.filter((e) => !taken.has(e.id));
    if (remaining.length === 0) break;
    const fresh = remaining.filter((e) => !usedPatterns.has(e.patterns[0]));
    const picked = weightedPick(rng, fresh.length ? fresh : remaining, history);
    if (!picked) break;
    chosen.push(picked); taken.add(picked.id); usedPatterns.add(picked.patterns[0]);
  }

  return chosen;
}

export function selectCombos(
  combos: Combo[], rng: Rng, history: HistoryEntry[], count: number,
): Combo[] {
  const chosen: Combo[] = [];
  const taken = new Set<string>();
  while (chosen.length < count) {
    const picked = weightedPick(rng, combos.filter((c) => !taken.has(c.id)), history);
    if (!picked) break;
    chosen.push(picked); taken.add(picked.id);
  }
  return chosen;
}
