import { generateText, hasToolCall, isStepCount, type LanguageModel } from 'ai';
import { applyPolicy } from '@/lib/policy';
import type { Outcome, RunEvent, RunFindings, Ticket } from '@/lib/types';
import { INSTRUCTIONS, ticketPrompt } from './instructions';
import { buildTools } from './tools';

export const MAX_STEPS = 8;

export interface RunAgentOptions {
  ticket: Ticket;
  model: LanguageModel;
  emit: (e: RunEvent) => void;
  now?: () => number;
  abortSignal?: AbortSignal;
}

export interface RunResult {
  outcome: Outcome;
  findings: RunFindings;
}

export async function runAgent({ ticket, model, emit, now = Date.now, abortSignal }: RunAgentOptions): Promise<RunResult> {
  const startedAt = now();
  const clock = () => now() - startedAt;
  const findings: RunFindings = { duplicateCharge: false, degradedComponents: [] };

  emit({ type: 'run-start', ticketId: ticket.id, at: 0 });
  await generateText({
    model,
    instructions: INSTRUCTIONS,
    prompt: ticketPrompt(ticket),
    tools: buildTools({ findings, emit, clock }),
    stopWhen: [isStepCount(MAX_STEPS), hasToolCall('draft_reply'), hasToolCall('escalate')],
    abortSignal,
  });

  const outcome = applyPolicy(ticket, findings);
  emit({ type: 'outcome', outcome, at: clock() });
  return { outcome, findings };
}
