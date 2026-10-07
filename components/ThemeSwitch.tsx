'use client';
// theme switch v1. The canonical copy lives in luvwadhwani/portfolio-hub. Copy it unchanged into each project.
import { useState, type ReactNode } from 'react';
import { themeAttribute, themeCookie, type Theme } from '@/lib/theme';

const icon = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: icon(
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>,
    ),
  },
  { value: 'dark', label: 'Dark', icon: icon(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />) },
  {
    value: 'system',
    label: 'Match device',
    icon: icon(
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>,
    ),
  },
];

/** Applies the choice to the page at once and remembers it for every project. */
function applyTheme(next: Theme) {
  const attr = themeAttribute(next);
  if (attr) document.documentElement.dataset.theme = attr;
  else delete document.documentElement.dataset.theme;
  document.cookie = themeCookie(next, window.location.hostname);
}

export function ThemeSwitch({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);
  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }
  return (
    <div className="lw-theme" role="group" aria-label="Colour mode">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" aria-label={o.label} title={o.label} aria-pressed={theme === o.value} onClick={() => choose(o.value)}>
          {o.icon}
        </button>
      ))}
    </div>
  );
}
