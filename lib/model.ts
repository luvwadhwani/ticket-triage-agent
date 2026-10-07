import type { LanguageModel } from 'ai';
import { scriptedModelFor } from './agent/scripted-model';

/** A plain model string is routed through the Vercel AI Gateway (auth: AI_GATEWAY_API_KEY or Vercel OIDC). */
export const MODEL_ID = process.env.TRIAGE_MODEL ?? 'anthropic/claude-sonnet-5.5';

/** E2E_MOCK_MODEL=1 swaps in the scripted model so browser tests never call, or pay for, the real one. Never set it on Vercel. */
export function getModel(ticketId: string): LanguageModel {
  if (process.env.E2E_MOCK_MODEL === '1') return scriptedModelFor(ticketId);
  return MODEL_ID;
}
