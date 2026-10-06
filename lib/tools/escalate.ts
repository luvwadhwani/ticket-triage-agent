import type { Escalation, ToolOutcome } from '@/lib/types';

export function escalate(input: Escalation): ToolOutcome<Escalation> {
  return { ok: true, output: input, summary: `To ${input.team}: ${input.reason}` };
}
