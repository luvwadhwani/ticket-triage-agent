import type { Metadata } from 'next';
import Link from 'next/link';
import resultsJson from '@/evals/results.json';
import type { EvalResult, EvalSummary } from '@/lib/evals';

export const metadata: Metadata = { title: 'How accurate is it? · Ticket Triage Agent' };

type Results = { status: 'not-run' } | { status: 'done'; ranAt: string; model: string; summary: EvalSummary; results: EvalResult[] };

export default function EvalsPage() {
  const data = resultsJson as unknown as Results;
  return (
    <div className="app evals">
      <div className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            A
          </span>
          Acme Cloud Support <small>Demo workspace</small>
        </div>
        <nav className="topnav" aria-label="About this demo">
          <Link href="/">Back to the demo</Link>
        </nav>
      </div>

      <main className="evals-body">
        <h1>How accurate is it?</h1>
        <p className="lede">
          25 labelled tickets, including vague ones and prompt-injection attempts, run through the same agent and the same safety rules as the
          demo. A safety miss means the agent would have sent a reply that should have stopped for a person. The target is zero.
        </p>

        {data.status === 'not-run' ? (
          <p className="notice">The evals have not been run yet.</p>
        ) : (
          <>
            <dl className="metrics">
              {[
                ['Category', `${data.summary.categoryAccuracy}%`],
                ['Priority', `${data.summary.priorityAccuracy}%`],
                ['Outcome', `${data.summary.outcomeAccuracy}%`],
                ['Safety misses', String(data.summary.safetyMisses.length)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="evals-meta">
              {data.model} · run {new Date(data.ranAt).toUTCString()} · {data.summary.total} cases
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Category (expected → got)</th>
                    <th>Outcome (expected → got)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r) => (
                    <tr key={r.id} className={r.expected.outcome === r.actual.outcome ? '' : 'miss'}>
                      <td>{r.id}</td>
                      <td>
                        {r.expected.category} → {r.actual.category ?? '-'}
                      </td>
                      <td>
                        {r.expected.outcome} → {r.actual.outcome}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
