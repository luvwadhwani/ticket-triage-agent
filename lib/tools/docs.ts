import { helpDocs } from '@/lib/data';
import type { HelpDoc, ToolOutcome } from '@/lib/types';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'how', 'can', 'you', 'your', 'with', 'our', 'are', 'this', 'that',
  'what', 'does', 'from', 'have', 'not', 'but', 'get', 'was', 'its', 'any', 'there', 'way',
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function scoreDoc(doc: HelpDoc, tokens: string[]): number {
  const title = doc.title.toLowerCase();
  const body = tokenize(doc.body);
  return tokens.reduce((sum, t) => sum + (title.includes(t) ? 3 : 0) + body.filter((w) => w === t).length, 0);
}

export function searchDocs({ query }: { query: string }): ToolOutcome<{ results: HelpDoc[] }> {
  const tokens = tokenize(query);
  const results = helpDocs
    .map((doc) => ({ doc, score: scoreDoc(doc, tokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.doc);
  if (results.length === 0) return { ok: false, output: { results }, summary: 'No matching help articles', tone: 'warn' };
  const more = results.length > 1 ? ` and ${results.length - 1} more` : '';
  return { ok: true, output: { results }, summary: `Found “${results[0].title}”${more}` };
}
