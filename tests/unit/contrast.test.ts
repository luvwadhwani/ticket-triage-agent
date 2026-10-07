import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Text colour → the backgrounds it sits on, as the stylesheet uses them.
const PAIRS: [string, string[]][] = [
  ['ink', ['bg', 'surface', 'surface-2', 'accent-soft']],
  ['muted', ['bg', 'surface', 'surface-2', 'accent-soft']],
  ['faint', ['bg', 'surface', 'surface-2', 'accent-soft']],
  ['accent', ['bg', 'surface']],
  ['accent-ink', ['accent']],
  ['ok', ['ok-soft']],
  ['warn', ['warn-soft']],
  ['danger', ['danger-soft']],
];

const css = readFileSync('app/globals.css', 'utf8');
const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const block = (selector: RegExp) => tokens(css.match(selector)?.[1] ?? '');
const light = block(/:root \{([^}]*)\}/);
const darkByChoice = block(/:root\[data-theme="dark"\] \{([^}]*)\}/);
const darkByDevice = block(/:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('colour contrast', () => {
  it('checks contrast the standard way', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  for (const [mode, t] of [['light', light], ['dark', darkByChoice]] as const) {
    it(`keeps every text colour at 4.5:1 or better on its backgrounds in ${mode} mode`, () => {
      const short = PAIRS.flatMap(([fg, bgs]) => bgs.map((bg) => ({ pair: `${fg} on ${bg}`, ratio: contrast(t[fg], t[bg]) }))).filter((p) => !(p.ratio >= 4.5));
      expect(short).toEqual([]);
    });
  }

  it('uses the same dark colours whether dark comes from the device or from the switch', () => {
    expect(darkByDevice).toEqual(darkByChoice);
  });
});
