import { helpDocs } from '@/lib/data';
import type { Draft, ToolOutcome } from '@/lib/types';

const DOC_TITLES = new Map(helpDocs.map((d) => [d.id, d.title]));

export function draftReply(input: Draft): ToolOutcome<Draft> {
  const citations = input.citations.filter((c) => DOC_TITLES.has(c));
  const output: Draft = { text: input.text.trim(), citations };
  const summary = citations.length > 0 ? `Cites ${citations.map((c) => DOC_TITLES.get(c)).join(', ')}` : 'No sources cited';
  return { ok: true, output, summary };
}
