/** The sections of the app. Only Write exists so far; the others say what is coming. */
const TABS = ['Write', 'Library', 'Shots', 'Queue', 'Music'] as const;

/**
 * Practice mode band: shown above everything, in a style used nowhere else, so sample clips can never be mistaken for
 * the user's film (doc/readme/ux.md, principle 4).
 */
export function PracticeBand() {
  return (
    <div className="practice-band" role="status">
      PRACTICE MODE · everything you make now is a sample clip, not your film
    </div>
  );
}

/**
 * The top bar: brand, project name and section tabs.
 * @param props.projectName Name of the open project.
 */
export function TopBar({ projectName }: { projectName: string }) {
  return (
    <header className="topbar">
      <div className="brand">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
          <path d="M8 4v6M13 9v6M17 14v6" stroke="#e0a030" />
        </svg>
        <span>Tapestry Studio</span>
      </div>
      <div className="project" aria-label="Project">
        {projectName}
      </div>
      <nav className="tabs" aria-label="Sections">
        {TABS.map((tab) =>
          tab === 'Write' ? (
            <span key={tab} className="tab on" aria-current="page">
              {tab}
            </span>
          ) : (
            <span key={tab} className="tab disabled" aria-disabled="true" title="Coming soon">
              {tab}
            </span>
          ),
        )}
      </nav>
    </header>
  );
}
