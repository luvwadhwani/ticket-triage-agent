import { getInvoicesFor } from '@/lib/data';
import type { Invoice, ToolOutcome } from '@/lib/types';

export interface InvoiceCheck {
  invoices: Invoice[];
  duplicateCharge: boolean;
  duplicates: Invoice[];
}

/** Paid invoices that share date, amount and description with another paid invoice. */
export function findDuplicates(invoices: Invoice[]): Invoice[] {
  const groups = new Map<string, Invoice[]>();
  for (const inv of invoices.filter((i) => i.status === 'paid')) {
    const key = `${inv.date}|${inv.amountUsd}|${inv.description}`;
    groups.set(key, [...(groups.get(key) ?? []), inv]);
  }
  return [...groups.values()].filter((g) => g.length > 1).flat();
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function getInvoices({ email }: { email: string }): ToolOutcome<InvoiceCheck> {
  const list = getInvoicesFor(email);
  const duplicates = findDuplicates(list);
  const output = { invoices: list, duplicateCharge: duplicates.length > 0, duplicates };
  if (list.length === 0) return { ok: false, output, summary: `No invoices found for ${email}`, tone: 'warn' };
  if (duplicates.length > 0) {
    const [first] = duplicates;
    return {
      ok: true,
      output,
      summary: `Found a duplicate charge: ${duplicates.length} × $${first.amountUsd} on ${shortDate(first.date)}`,
      tone: 'warn',
    };
  }
  return { ok: true, output, summary: `${list.length} recent invoice${list.length === 1 ? '' : 's'}, no duplicate charges` };
}
