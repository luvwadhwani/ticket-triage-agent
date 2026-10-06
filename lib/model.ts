import type { LanguageModel } from 'ai';

/** A plain model string is routed through the Vercel AI Gateway (auth: AI_GATEWAY_API_KEY or Vercel OIDC). */
export const MODEL_ID = process.env.TRIAGE_MODEL ?? 'anthropic/claude-sonnet-5.5';

export function getModel(): LanguageModel {
  return MODEL_ID;
}
