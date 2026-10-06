import type { Classification, ToolOutcome } from '@/lib/types';

export function classifyTicket(input: Classification): ToolOutcome<Classification> {
  const confidence = Math.min(1, Math.max(0, input.confidence));
  const output: Classification = { ...input, confidence, intents: [...new Set(input.intents)] };
  return { ok: true, output, summary: `${output.category}, ${output.priority.toLowerCase()} priority` };
}
