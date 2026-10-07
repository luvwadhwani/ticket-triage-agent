// top bar v1. The canonical copy lives in luvwadhwani/portfolio-hub (components/TopBar.tsx + topbar.css).
// Copy both files unchanged into each project.
import './topbar.css';

export function TopBar({ viewerName, hubUrl }: { viewerName: string; hubUrl: string }) {
  return (
    <nav className="lw-topbar" aria-label="Luv Wadhwani's workspace">
      <a className="lw-name" href={hubUrl}>
        Luv Wadhwani
      </a>
      <a href={hubUrl}>All projects</a>
      <span className="lw-viewer">Signed in as {viewerName}</span>
      <form method="post" action={`${hubUrl}/api/sign-out`}>
        <button type="submit">Sign out</button>
      </form>
    </nav>
  );
}
