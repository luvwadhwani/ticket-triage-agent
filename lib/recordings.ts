import { recordings } from '@/runs';
import { recordedRunSchema } from './schemas';
import type { RecordedRun } from './types';

export function parseRecording(raw: unknown, ticketId: string): RecordedRun | null {
  const parsed = recordedRunSchema.safeParse(raw);
  return parsed.success && parsed.data.ticketId === ticketId ? parsed.data : null;
}

export function getRecording(ticketId: string): RecordedRun | null {
  return parseRecording(recordings[ticketId], ticketId);
}
