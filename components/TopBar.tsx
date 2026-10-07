// top bar v3. The canonical copy lives in luvwadhwani/portfolio-hub (components/TopBar.tsx, ThemeSwitch.tsx,
// topbar.css and lib/theme.ts). Copy all four unchanged into each project.
import type { Theme } from '@/lib/theme';
import { ThemeSwitch } from './ThemeSwitch';
import './topbar.css';

export interface TopBarViewer {
  name: string;
  admin: boolean;
}

export function TopBar({ viewer, hubUrl, theme }: { viewer: TopBarViewer | null; hubUrl: string; theme: Theme }) {
  return (
    <header className="lw-topbar">
      <a className="lw-name" href={`${hubUrl}/`}>
        Luv Wadhwani
      </a>
      {viewer && (
        <nav className="lw-nav" aria-label="Workspace">
          <a href={`${hubUrl}/`}>Projects</a>
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
