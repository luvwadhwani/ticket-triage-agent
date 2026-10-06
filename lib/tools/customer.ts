import { getCustomer } from '@/lib/data';
import type { Customer, ToolOutcome } from '@/lib/types';

export function lookupCustomer({ email }: { email: string }): ToolOutcome<Customer | { found: false; email: string }> {
  const c = getCustomer(email);
  if (!c) return { ok: false, output: { found: false, email }, summary: `No customer found for ${email}`, tone: 'warn' };
  const status = c.status === 'active' ? '' : `, ${c.status.replace('_', ' ')}`;
  return { ok: true, output: c, summary: `${c.name}, ${c.plan} plan${status}, customer since ${c.since.slice(0, 4)}` };
}
