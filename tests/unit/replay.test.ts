import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replay, replayDelays } from '@/lib/replay';
import type { RunEvent } from '@/lib/types';

const ev = (at: number): RunEvent => ({ type: 'run-start', ticketId: 't1', at });

describe('replayDelays', () => {
  it('speeds up the real gaps and clamps them between 150 and 1200 ms', () => {
    expect(replayDelays([ev(0), ev(30), ev(1500), ev(9000)])).toEqual([0, 150, 980, 1200]);
  });
});

describe('replay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits events in order with the delays', async () => {
    const seen: number[] = [];
    const done = replay([ev(0), ev(600), ev(1200)], (e) => seen.push(e.at));
    await vi.advanceTimersByTimeAsync(400);
    expect(seen).toEqual([0, 600]);
    await vi.advanceTimersByTimeAsync(400);
    await done;
    expect(seen).toEqual([0, 600, 1200]);
  });

  it('stops emitting when aborted', async () => {
    const seen: number[] = [];
    const ctrl = new AbortController();
    const done = replay([ev(0), ev(600), ev(1200)], (e) => seen.push(e.at), { signal: ctrl.signal });
    await vi.advanceTimersByTimeAsync(100);
    ctrl.abort();
    await expect(done).rejects.toThrow('Aborted');
    await vi.advanceTimersByTimeAsync(2000);
    expect(seen).toEqual([0]);
  });
});
