import { Console } from '@/components/Console';
import { getCustomer, helpDocs, tickets } from '@/lib/data';
import { formatClock, inboxStatus, type TicketView } from '@/lib/present';
import { getRecording } from '@/lib/recordings';
import type { RecordedRun } from '@/lib/types';

function lastOutcome(rec: RecordedRun | null) {
  const e = rec?.events.findLast((x) => x.type === 'outcome');
  return e?.type === 'outcome' ? e.outcome : null;
}

export default async function Home({ searchParams }: PageProps<'/'>) {
  const sp = await searchParams;
  const initialTicketId = typeof sp.ticket === 'string' && tickets.some((t) => t.id === sp.ticket) ? sp.ticket : tickets[0].id;
  const recordings = Object.fromEntries(tickets.map((t) => [t.id, getRecording(t.id)]));
  const views: TicketView[] = tickets.map((t) => ({
    ...t,
    name: getCustomer(t.from)?.name ?? t.from,
    received: t.receivedAt ? formatClock(t.receivedAt) : '',
    status: inboxStatus(lastOutcome(recordings[t.id])),
  }));
  const docTitles = Object.fromEntries(helpDocs.map((d) => [d.id, d.title]));
  return <Console tickets={views} recordings={recordings} docTitles={docTitles} repoUrl={process.env.NEXT_PUBLIC_REPO_URL ?? null} initialTicketId={initialTicketId} />;
}
