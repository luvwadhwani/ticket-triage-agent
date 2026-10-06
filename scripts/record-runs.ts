import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runAgent } from '@/lib/agent/run';
import { scriptedModelFor, tickClock } from '@/lib/agent/scripted-model';
import { tickets } from '@/lib/data';
import { getModel, MODEL_ID } from '@/lib/model';
import type { RecordedRun, RunEvent } from '@/lib/types';

const mock = process.argv.includes('--mock');
const only = process.argv.find((a) => a.startsWith('--ticket='))?.split('=')[1];

for (const ticket of tickets.filter((t) => !only || t.id === only)) {
  const events: RunEvent[] = [];
  const { outcome } = await runAgent({
    ticket,
    model: mock ? scriptedModelFor(ticket.id) : getModel(),
    emit: (e) => events.push(e),
    now: mock ? tickClock() : undefined,
  });
  const recording: RecordedRun = {
    ticketId: ticket.id,
    recordedAt: new Date().toISOString(),
    model: mock ? 'mock' : MODEL_ID,
    events,
  };
  writeFileSync(join(process.cwd(), 'runs', `${ticket.id}.json`), `${JSON.stringify(recording, null, 2)}\n`);
  const rule = 'rule' in outcome && outcome.rule ? ` (${outcome.rule})` : '';
  console.log(`${ticket.id}: ${outcome.status}${rule}, ${events.length} events`);
}
