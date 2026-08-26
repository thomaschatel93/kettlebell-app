import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { ProgressBar } from "@/components/ProgressBar";
import { Ring } from "@/components/Ring";
import { PATTERNS } from "@/lib/types";

const SUBTITLES: Record<string, string> = {
  hinge: "glutes, hamstrings, back",
  squat: "quads, glutes",
  push: "shoulders, chest, triceps",
  pull: "back, biceps",
  carry: "grip, trunk",
  core: "trunk, hips",
};

/**
 * Holding page for the shared primitives. The Home screen replaces this.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Kettlebell</h1>

      <Card className="flex items-center gap-5">
        <Ring value={2} max={5} label="Workouts this week" caption="this week" />
        <div>
          <p className="text-lg font-bold">Two down</p>
          <p className="text-sm text-[var(--text-dim)]">Three left to hit five.</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {PATTERNS.map((pattern, i) => (
          <Chip key={pattern} tone={pattern} subtitle={SUBTITLES[pattern]} selected={i < 2}>
            {pattern[0].toUpperCase() + pattern.slice(1)}
          </Chip>
        ))}
      </div>

      <ProgressBar value={3} max={10} label="Workout progress" />

      <div className="flex flex-col gap-3">
        <Button>Start workout</Button>
        <Button variant="ghost">Change kit</Button>
        <Button variant="danger">End session</Button>
        <Button disabled>Pick a pattern first</Button>
      </div>
    </main>
  );
}
