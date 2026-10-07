// top bar v4. The canonical copy lives in luvwadhwani/portfolio-hub (components/TopBar.tsx, ThemeSwitch.tsx,
// topbar.css and lib/theme.ts). Copy all four unchanged into each project.
import type { NavProject } from '@/lib/gate';
import type { Theme } from '@/lib/theme';
import { ThemeSwitch } from './ThemeSwitch';
import './topbar.css';

export interface TopBarViewer {
  name: string;
  admin: boolean;
  /** The projects this person may open, as the pass lists them: one tab each. */
  projects: NavProject[];
}

/** `current` is the id of the project this bar sits in, so its tab is marked; null on the hub. */
export function TopBar({ viewer, hubUrl, theme, current = null }: { viewer: TopBarViewer | null; hubUrl: string; theme: Theme; current?: string | null }) {
  return (
    <header className="lw-topbar">
      <a className="lw-name" href={`${hubUrl}/`}>
        Luv Wadhwani
      </a>
      {viewer && (viewer.projects.length > 0 || viewer.admin) && (
        <nav className="lw-nav" aria-label="Workspace">
          {viewer.projects.map((p) => (
            <a key={p.id} href={`${p.url}/`} aria-current={p.id === current ? 'page' : undefined}>
              {p.name}
            </a>
          ))}
          {viewer.admin && <a href={`${hubUrl}/admin`}>Admin</a>}
        </nav>
      )}
      <span className="lw-spacer" />
      <ThemeSwitch initial={theme} />
      {viewer && (
        <>
          <span className="lw-viewer">Signed in as {viewer.name}</span>
          <form method="post" action={`${hubUrl}/api/sign-out`}>
            <button type="submit" className="lw-signout">
              Sign out
            </button>
          </form>
        </>
      )}
    </header>
  );
}
