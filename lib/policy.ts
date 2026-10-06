import type { Intent, Outcome, RuleId, RunFindings, Team, Ticket } from '@/lib/types';

export const CONFIDENCE_FLOOR = 0.7;

/** Deterministic backstop for common phrasings, so a wrong classification has to slip past a second check to skip a rule. */
const KEYWORDS: Array<[Intent, RegExp]> = [
  [
    'refund',
    /\b(refund\w*|chargeback\w*|money back|reimburs\w*)\b|\bcharged\b[\s\S]{0,20}\btwice\b|\bdouble[- ]charged\b|\b(two|double|duplicate|multiple)\s+charg\w*|\brevers\w*\s+(the\s+|a\s+|my\s+|this\s+)?charg\w*/i,
  ],
  ['cancel', /\bcancel\w*|\b(close|delete|terminate)\b[\s\S]{0,25}\b(account|subscription|workspace)\b/i],
  ['security', /\b(password|sso|2fa|mfa|two[- ]factor|2[- ]factor|log ?in|sign ?in|locked out|hacked|suspicious)\b/i],
  [
    'incident',
    /\b(is|are|was|were|went|been|goes|going|seems?)\s+down\b|\bdown\s+(for|since|again)\b|\b(outage|not responding|unavailable|timeouts?|timing out)\b|\b5\d\d\s+errors?\b|\b(error|status)\s+5\d\d\b/i,
  ],
];

export function keywordIntents(text: string): Intent[] {
  return KEYWORDS.filter(([, re]) => re.test(text)).map(([intent]) => intent);
}

export const RULE_TEXT: Record<RuleId, string> = {
  refund: 'Refunds always need human approval.',
  'account-deletion': 'Cancelling or deleting an account always needs a human.',
  security: 'Sign-in and security issues always go to a human.',
  'low-confidence': 'The agent was less than 70% sure, so a human checks it.',
  incident: 'A possible outage goes straight to Engineering.',
  'couldnt-finish': "The agent couldn't finish, so a human takes over.",
};

/** Runs after the agent. Rules are checked most severe first and can only make the outcome more cautious. */
export function applyPolicy(ticket: Ticket, f: RunFindings): Outcome {
  if (!f.proposal) {
    return { status: 'escalated', team: 'Success', rule: 'couldnt-finish', reason: RULE_TEXT['couldnt-finish'] };
  }
  const draft = f.proposal.kind === 'reply' ? f.proposal.draft : undefined;
  const withDraft = draft ? { draft } : {};
  const intents = new Set<Intent>([
    ...(f.classification?.intents ?? []),
    ...keywordIntents(`${ticket.subject}\n${ticket.body}`),
  ]);
  const needsHuman = (rule: RuleId): Outcome => ({ status: 'needs-human', rule, reason: RULE_TEXT[rule], ...withDraft });

  const incident: Outcome = { status: 'escalated', team: 'Engineering', rule: 'incident', reason: RULE_TEXT.incident, ...withDraft };

  // An outage the customer reports goes to Engineering first; a degraded component the agent merely
  // noticed must not outrank a refund, cancellation or security issue in the ticket itself.
  if (intents.has('incident')) return incident;
  if (intents.has('refund') || f.duplicateCharge) return needsHuman('refund');
  if (intents.has('cancel')) return needsHuman('account-deletion');
  if (intents.has('security')) return needsHuman('security');
  if (f.degradedComponents.length > 0) return incident;
  if (!f.classification || f.classification.confidence < CONFIDENCE_FLOOR) return needsHuman('low-confidence');
  if (f.proposal.kind === 'escalate') {
    return { status: 'escalated', team: f.proposal.escalation.team, reason: f.proposal.escalation.reason };
  }
  return { status: 'ready-to-send', draft: f.proposal.draft };
}

const RULE_TEAM: Record<RuleId, Team> = {
  refund: 'Billing',
  'account-deletion': 'Success',
  security: 'Security',
  'low-confidence': 'Success',
  incident: 'Engineering',
  'couldnt-finish': 'Success',
};

export function teamForEscalation(outcome: Outcome): Team {
  if (outcome.status === 'escalated') return outcome.team;
  if (outcome.status === 'needs-human') return RULE_TEAM[outcome.rule];
  return 'Success';
}
