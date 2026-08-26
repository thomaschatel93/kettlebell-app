import type { Metadata } from 'next';
import { KitEditor } from '@/components/KitEditor';

export const metadata: Metadata = {
  title: 'Kit',
  description: 'The bells you own, where you train, and what you can lift.',
};

/**
 * The tab a new user lands on first: nothing else in the app works until it
 * knows which bells exist. The editor itself is the client component; this page
 * stays a Server Component so only the interactive part ships to the browser.
 */
export default function KitPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Your kit</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          Workouts are built from this. Nothing gets prescribed that you do not own.
        </p>
      </header>

      <KitEditor />
    </main>
  );
}
