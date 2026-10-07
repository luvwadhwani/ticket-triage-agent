// top bar v6. The canonical copy lives in luvwadhwani/portfolio-hub (components/TopBar.tsx, BarMenu.tsx, ThemeSwitch.tsx,
// topbar.css and lib/theme.ts). Copy all five unchanged into each project.
import type { ReactNode } from 'react';
import type { NavProject } from '@/lib/gate';
import type { Theme } from '@/lib/theme';
import { BarMenu } from './BarMenu';
import { ThemeSwitch } from './ThemeSwitch';
import './topbar.css';

export interface TopBarViewer {
  name: string;
  admin: boolean;
  /** The projects this person may open, as the pass lists them: one tab each. */
  projects: NavProject[];
}

/** Two letters for the avatar: the first letters of the first and last words ("Acme Corp – Priya" → "AP"). */
export function initials(name: string): string {
  const [first, ...rest]: string[] = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!first) return '?';
  return (first.charAt(0) + (rest.at(-1)?.charAt(0) ?? '')).toUpperCase();
}

const icon = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

/** What each project is, at a glance. A project without its own glyph gets the grid. */
const GLYPHS: Record<string, ReactNode> = {
  triage: icon(
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" />
    </>,
  ),
  qa: icon(
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="m9 14 2 2 4-4" />
    </>,
  ),
  twin: icon(
    <>
      <circle cx="12" cy="9" r="1.6" />
      <path d="M12 7.4V2.5M13.4 9.8l4.3 2.4M10.6 9.8l-4.3 2.4M12 10.6V22M9 22h6" />
    </>,
  ),
};
const GRID = icon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>,
);
const SHIELD = icon(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />);
const SIGN_OUT = icon(<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />);
const CHEVRON = (
  <svg className="lw-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** `current` is the id of the project this bar sits in, so its tab is marked; null on the hub. */
export function TopBar({ viewer, hubUrl, theme, current = null }: { viewer: TopBarViewer | null; hubUrl: string; theme: Theme; current?: string | null }) {
  return (
    <header className="lw-topbar">
      <div className="lw-brand">
        <a className="lw-home" href={`${hubUrl}/`}>
          <span className="lw-mark" aria-hidden="true">
            LW
          </span>
          <span className="lw-name">Luv Wadhwani</span>
        </a>
        <span className="lw-space">Client workspace</span>
      </div>
      {viewer && viewer.projects.length > 0 && (
        <nav className="lw-tabs" aria-label="Workspace">
          {viewer.projects.map((p) => (
            <a key={p.id} className="lw-tab" href={p.url} aria-current={p.id === current ? 'page' : undefined}>
              {GLYPHS[p.id] ?? GRID}
              {p.name}
            </a>
          ))}
        </nav>
      )}
      <span className="lw-spacer" />
      <ThemeSwitch initial={theme} />
      {viewer && (
        <BarMenu
          label={`Signed in as ${viewer.name}`}
          className="lw-account"
          trigger={
            <>
              <span className="lw-avatar" aria-hidden="true">
                {initials(viewer.name)}
              </span>
              <span className="lw-account-name">{viewer.name}</span>
              {CHEVRON}
            </>
          }
        >
          <p className="lw-menu-head">
            <span>Signed in as</span>
            <b>{viewer.name}</b>
          </p>
          <a href={`${hubUrl}/`}>
            {GRID}
            All projects
          </a>
          {viewer.admin && (
            <a href={`${hubUrl}/admin`}>
              {SHIELD}
              Admin
            </a>
          )}
          <hr />
          <form method="post" action={`${hubUrl}/api/sign-out`}>
            <button type="submit">
              {SIGN_OUT}
              Sign out
            </button>
          </form>
        </BarMenu>
      )}
    </header>
  );
}
