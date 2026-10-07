'use client';
// theme switch v2. The canonical copy lives in luvwadhwani/portfolio-hub. Copy it unchanged into each project.
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { themeAttribute, themeCookie, themeFromCookies, type Theme } from '@/lib/theme';

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

/**
 * Applies the choice to the page at once and remembers it for every project. Rewriting the cookie on each
 * visit also keeps it alive in Safari, which ends cookies written by scripts after 7 days.
 */
function applyTheme(next: Theme) {
  const attr = themeAttribute(next);
  if (attr) document.documentElement.dataset.theme = attr;
  else delete document.documentElement.dataset.theme;
  document.cookie = themeCookie(next, window.location.hostname);
}

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const cookieChoice = () => themeFromCookies(document.cookie);

export function ThemeSwitch({ initial }: { initial: Theme }) {
  // The cookie, not the server-rendered `initial`, says what's chosen: after Back or Forward the page can
  // come from a cache that predates the last choice.
  const theme = useSyncExternalStore(subscribe, cookieChoice, () => initial);
  useEffect(() => applyTheme(cookieChoice()), []);
  function choose(next: Theme) {
    applyTheme(next);
    listeners.forEach((listener) => listener());
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
