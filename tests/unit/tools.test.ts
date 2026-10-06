import { describe, expect, it } from 'vitest';
import { classifyTicket } from '@/lib/tools/classify';
import { lookupCustomer } from '@/lib/tools/customer';
import { searchDocs, tokenize } from '@/lib/tools/docs';
import { escalate } from '@/lib/tools/escalate';
import { getInvoices } from '@/lib/tools/invoices';
import { draftReply } from '@/lib/tools/reply';
import { getServiceStatus } from '@/lib/tools/status';

describe('classifyTicket', () => {
  it('dedupes intents and summarises category and priority in plain words', () => {
    const r = classifyTicket({ category: 'Billing', priority: 'High', confidence: 0.934, intents: ['refund', 'refund'] });
    expect(r.output.intents).toEqual(['refund']);
    expect(r.summary).toBe('Billing, high priority');
  });
});

describe('lookupCustomer', () => {
  it('finds a customer and summarises the account', () => {
    const r = lookupCustomer({ email: 'maya@example.com' });
    expect(r.ok).toBe(true);
    expect(r.summary).toBe('Maya Chen, Pro plan, customer since 2024');
  });
  it('mentions the account status only when it is not active', () => {
    expect(lookupCustomer({ email: 'chris@example.net' }).summary).toBe('Chris Moreau, Pro plan, past due, customer since 2023');
  });
  it('reports an unknown email as a warning, without throwing', () => {
    const r = lookupCustomer({ email: 'nobody@example.com' });
    expect(r.ok).toBe(false);
    expect(r.tone).toBe('warn');
    expect(r.output).toEqual({ found: false, email: 'nobody@example.com' });
  });
});

describe('getInvoices', () => {
  it("flags Maya's duplicate October charge as a warning", () => {
    const r = getInvoices({ email: 'maya@example.com' });
    expect(r.output.duplicateCharge).toBe(true);
    expect(r.summary).toBe('Found a duplicate charge: 2 × $49 on Oct 3');
    expect(r.tone).toBe('warn');
  });
  it('finds no problem for a normal customer, with correct plurals', () => {
    const one = getInvoices({ email: 'sam@example.com' });
    expect(one.output.duplicateCharge).toBe(false);
    expect(one.summary).toBe('1 recent invoice, no duplicate charges');
    expect(one.tone).toBeUndefined();
    expect(getInvoices({ email: 'chris@example.net' }).summary).toBe('2 recent invoices, no duplicate charges');
  });
  it('is not ok when there are no invoices', () => {
    expect(getInvoices({ email: 'li@example.net' }).ok).toBe(false);
  });
});

describe('getServiceStatus', () => {
  it('reports the degraded API as danger', () => {
    const r = getServiceStatus();
    expect(r.output.degraded).toEqual(['API']);
    expect(r.summary).toBe('API is degraded');
    expect(r.tone).toBe('danger');
  });
});

describe('searchDocs', () => {
  it('ignores short words and stop words', () => {
    expect(tokenize('How do I export to CSV?')).toEqual(['export', 'csv']);
  });
  it('ranks the CSV export article first', () => {
    const r = searchDocs({ query: 'export reports CSV' });
    expect(r.output.results[0].id).toBe('doc-export-csv');
    expect(r.summary).toMatch(/^Found “Export your data to CSV”/);
  });
  it('ranks the refund policy first for a duplicate charge', () => {
    expect(searchDocs({ query: 'duplicate charge refund' }).output.results[0].id).toBe('doc-refunds');
  });
  it('returns at most 3 results, and none for nonsense', () => {
    expect(searchDocs({ query: 'plan billing settings team' }).output.results.length).toBeLessThanOrEqual(3);
    const none = searchDocs({ query: 'zzqx' });
    expect(none.ok).toBe(false);
    expect(none.output.results).toEqual([]);
  });
});

describe('draftReply', () => {
  it('drops citations that are not real help articles and names the sources by title', () => {
    const r = draftReply({ text: '  Hello  ', citations: ['doc-refunds', 'doc-made-up'] });
    expect(r.output).toEqual({ text: 'Hello', citations: ['doc-refunds'] });
    expect(r.summary).toBe('Cites Refund policy');
  });
  it('says so when nothing is cited', () => {
    expect(draftReply({ text: 'Hi', citations: [] }).summary).toBe('No sources cited');
  });
});

describe('escalate', () => {
  it('summarises the hand-off', () => {
    expect(escalate({ team: 'Engineering', reason: 'API errors' }).summary).toBe('To Engineering: API errors');
  });
});
