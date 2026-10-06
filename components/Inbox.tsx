import { initials, type TicketView } from '@/lib/present';

export function Inbox({ tickets, selectedId, onSelect }: { tickets: TicketView[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <section className="inbox" aria-label="Inbox">
      <div className="inbox-head">
        <h2>Inbox</h2>
        <span>{tickets.length} open</span>
      </div>
      <ul>
        {tickets.map((t) => (
          <li key={t.id}>
            <button type="button" className="item" aria-pressed={t.id === selectedId} onClick={() => onSelect(t.id)}>
              <span className="avatar" aria-hidden="true">
                {initials(t.name)}
              </span>
              <span className="item-text">
                <span className="row1">
                  <span>{t.name}</span>
                  <time dateTime={t.receivedAt}>{t.received}</time>
                </span>
                <span className="subj">{t.subject}</span>
                <span className="snip">{t.body}</span>
                {t.status && <span className={`status s-${t.status.kind}`}>{t.status.label}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
