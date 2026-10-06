import type { RunEvent } from './types';

export interface ReplayOptions {
  speed?: number;
  minGapMs?: number;
  maxGapMs?: number;
}

export function replayDelays(events: RunEvent[], { speed = 1.5, minGapMs = 150, maxGapMs = 1200 }: ReplayOptions = {}): number[] {
  return events.map((e, i) =>
    i === 0 ? 0 : Math.min(maxGapMs, Math.max(minGapMs, Math.round((e.at - events[i - 1].at) / speed))),
  );
}

const aborted = () => new DOMException('Aborted', 'AbortError');

export async function replay(
  events: RunEvent[],
  onEvent: (e: RunEvent) => void,
  opts: ReplayOptions & { signal?: AbortSignal } = {},
): Promise<void> {
  const delays = replayDelays(events, opts);
  for (let i = 0; i < events.length; i++) {
    if (delays[i] > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delays[i]);
        opts.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(aborted());
          },
          { once: true },
        );
      });
    }
    if (opts.signal?.aborted) throw aborted();
    onEvent(events[i]);
  }
}
