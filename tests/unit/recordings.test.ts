import { describe, expect, it } from 'vitest';
import { tickets } from '@/lib/data';
import { getRecording, parseRecording } from '@/lib/recordings';

describe('recordings', () => {
  it('every preset ticket has a valid recording ending in an outcome', () => {
    for (const t of tickets) {
      const rec = getRecording(t.id);
      expect(rec, t.id).not.toBeNull();
      expect(rec!.events.at(-1)?.type, t.id).toBe('outcome');
    }
  });

  it('rejects corrupt, empty or mismatched recordings instead of throwing', () => {
    expect(parseRecording(undefined, 't1')).toBeNull();
    expect(parseRecording({ nope: true }, 't1')).toBeNull();
    expect(parseRecording({ ...getRecording('t1'), events: [] }, 't1')).toBeNull();
    expect(parseRecording({ ...getRecording('t1'), ticketId: 't2' }, 't1')).toBeNull();
  });

  it.skipIf(!process.env.RELEASE)('release gate: ships real recordings, not mock ones', () => {
    for (const t of tickets) expect(getRecording(t.id)?.model, t.id).not.toBe('mock');
  });
});
