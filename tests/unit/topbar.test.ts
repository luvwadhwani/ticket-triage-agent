import { describe, expect, it } from 'vitest';
import { initials } from '@/components/TopBar';

describe('initials', () => {
  it("takes the first letter of the first and last word, so a company and person read as one monogram", () => {
    expect(initials('Acme Corp – Priya')).toBe('AP');
    expect(initials('Luv Wadhwani')).toBe('LW');
    expect(initials('initech-bill')).toBe('IB');
  });

  it('copes with one word, accents and an empty name', () => {
    expect(initials('Priya')).toBe('P');
    expect(initials('Émile Zola')).toBe('ÉZ');
    expect(initials(' – ')).toBe('?');
  });
});
