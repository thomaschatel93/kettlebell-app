import type { Metadata } from 'next';
import { HistoryScreen } from '@/components/HistoryScreen';

export const metadata: Metadata = {
  title: 'History',
  description: 'Every session you have finished, newest first.',
};

/**
 * The record. The list itself is the client component, because it reads stored
 * history; this page stays a Server Component so only that part ships.
 */
export default function HistoryPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          The last thirty sessions. Tap one to see what was in it.
        </p>
      </header>

      <HistoryScreen />
    </main>
  );
}
